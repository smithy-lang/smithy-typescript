package software.amazon.smithy.typescript.codegen;

import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.OperationIndex;
import software.amazon.smithy.model.knowledge.PaginatedIndex;
import software.amazon.smithy.model.knowledge.PaginationInfo;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.traits.PaginatedTrait;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

final class PaginationGenerator implements Runnable {

    private final TypeScriptSettings settings;
    private final Model model;
    private final ServiceShape service;
    private final OperationShape operation;
    private final SymbolProvider symbolProvider;
    private final TypeScriptWriter writer;
    private final Symbol symbol;
    private final List<RuntimeClientPlugin> runtimePlugins;
    private final OperationIndex operationIndex;
    private final Symbol inputType;
    private final Symbol outputType;
    private final ProtocolGenerator protocolGenerator;
    private final ApplicationProtocol applicationProtocol;
    private final PaginationInfo paginatedInfo;

    private Symbol serviceSymbol;
    private Symbol operationSymbol;
    private Symbol inputSymbol;
    private Symbol outputSymbol;

    private String methodName;
    private String nonModularServiceName;
//    private String commandName;
//    private String commandInput;
//    private String commandOutput;
//    private String serviceClassName;
//    private String serviceClientClassName;
    private String paginationType;

    PaginationGenerator(TypeScriptSettings settings,
                        Model model,
                        OperationShape operation,
                        SymbolProvider symbolProvider,
                        TypeScriptWriter writer,
                        List<RuntimeClientPlugin> runtimePlugins,
                        ProtocolGenerator protocolGenerator,
                        ApplicationProtocol applicationProtocol,
                        String nonModularServiceName){

        this.settings = settings;
        this.model = model;
        this.service = settings.getService(model);
        this.operation = operation;
        this.symbolProvider = symbolProvider;
        this.writer = writer;
        this.runtimePlugins = runtimePlugins.stream()
                .filter(plugin -> plugin.matchesOperation(model, service, operation))
                .collect(Collectors.toList());
        this.protocolGenerator = protocolGenerator;
        this.applicationProtocol = applicationProtocol;

        symbol = symbolProvider.toSymbol(operation);
        operationIndex = model.getKnowledge(OperationIndex.class);
        inputType = symbol.expectProperty("inputType", Symbol.class);
        outputType = symbol.expectProperty("outputType", Symbol.class);

        String operationName = operation.getId().getName(); //ListObjects
//        this.methodName = Character.toLowerCase(operationName.charAt(0)) + operationName.substring(1); //listObjects
//        this.commandName = operationName + "Command"; //ListObjectsCommand
//        this.commandInput = commandName + "Input"; //ListObjectsCommandInput
//        this.commandOutput = commandName + "Output"; //ListObjectsCommandOutput
//        this.serviceClassName = service.getId().getName(); // S3
//        this.serviceClientClassName = serviceClassName + "Client"; // S3Client
//        this.paginationType = this.serviceClassName + "PaginationConfiguration";

        this.serviceSymbol = symbolProvider.toSymbol(service);
        this.operationSymbol = symbolProvider.toSymbol(operation);
        this.inputSymbol = symbolProvider.toSymbol(operation).expectProperty("inputType", Symbol.class);
        this.outputSymbol = symbolProvider.toSymbol(operation).expectProperty("outputType", Symbol.class);


        this.nonModularServiceName = nonModularServiceName;
        this.methodName = Character.toLowerCase(operationName.charAt(0)) + operationName.substring(1); // e.g. listObjects

//        this.commandName = commandSymbol.getName(); //ListObjectsCommand
//        this.commandInput = inputSymbol.getName(); //ListObjectsCommandInput
//        this.commandOutput = outputSymbol.getName(); //ListObjectsCommandOutput
//        this.serviceClassName = service.getId().getName(); // S3
//        this.serviceClientClassName = symbolProvider.toSymbol(service).getName(); // S3Client
        this.paginationType = this.nonModularServiceName + "PaginationConfiguration";


        Symbol serviceSym = symbolProvider.toSymbol(service);


        Optional<PaginationInfo> paginationInfo = model.getKnowledge(PaginatedIndex.class).getPaginationInfo(this.service, this.operation);
        this.paginatedInfo = paginationInfo.orElseThrow(() -> {return new CodegenException("Expected Paginator to have pagination information.");});
    }

    @Override
    public void run() {
        Symbol serviceSymbol = symbolProvider.toSymbol(service);
        String configType = ServiceGenerator.getResolvedConfigTypeName(serviceSymbol);

        writer.addImport(configType, configType, serviceSymbol.getNamespace());

        // Import Service Types
        writer.addImport(this.operationSymbol.getName(), this.operationSymbol.getName(), this.operationSymbol.getNamespace());
        writer.addImport(this.inputSymbol.getName(), this.inputSymbol.getName(), this.inputSymbol.getNamespace());
        writer.addImport(this.outputSymbol.getName(), this.outputSymbol.getName(), this.outputSymbol.getNamespace());
        writer.addImport(this.nonModularServiceName, this.nonModularServiceName, this.serviceSymbol.getNamespace().replace(this.serviceSymbol.getName(), this.nonModularServiceName));
        writer.addImport(this.serviceSymbol.getName(), this.serviceSymbol.getName(), this.serviceSymbol.getNamespace());

        // Import Pagination types
        writer.addImport("PaginationConfiguration", "PaginationConfiguration", "@aws-sdk/types");
        writer.addImport("Paginator", "Paginator", "@aws-sdk/types");

        this.writeInterfaces();
        this.writeClientSideRequest();
        this.writeFullRequest();
        this.writePaginator();

    }

    private void writeInterfaces(){
        writer.openBlock("interface $L extends PaginationConfiguration {",
                "}", this.paginationType, () -> {
            writer.write("client: $L | $L ", this.nonModularServiceName, this.serviceSymbol.getName());
        });
    }

    private void writePaginator(){
        writer.openBlock("export async function* $LPaginate(config: $L, input: $L, ...commandArgs: any): Promise<$L>{", "}", this.methodName, this.paginationType, this.commandInput, this.commandOutput, () -> {
            writer.write("let token = config.startingToken || '';");
            writer.openBlock("const keyMapping = {", "}", () -> {
                if (this.paginatedInfo.getPageSizeMember().isPresent()){
                    writer.write("limitKey: \"$L\",", this.paginatedInfo.getPageSizeMember().get());
                }
                writer.write("inputToken: \"$L\",", this.paginatedInfo.getInputTokenMember().getMemberName());
                writer.write("outputToken: \"$L\",", this.paginatedInfo.getOutputTokenMember().getMemberName());
            });

            writer.write("let hasNext = true;");
            writer.write("let page:$L;", this.commandOutput);
            writer.openBlock("while (hasNext) {", "}", () -> {
                writer.write("input[keyMapping.inputToken] = token;");
                writer.write("input[keyMapping.limitKey] = config.pageSize;");
                writer.openBlock("if(config.client instanceof $L) {", "}", this.serviceClassName, () -> {
                    writer.write("page = await makePagedRequest(config.client, input, ...additionalArguments);");
                });
                writer.openBlock("else if (config.client instanceof $L) {", "}", this.serviceClientClassName, () -> {
                    writer.write(" page = await makePagedClientRequest(config.client, input, ...additionalArguments);");
                });
                writer.openBlock("else {", "}", () -> {
                    writer.write(" throw new Error(\"Invalid client, expected $L | $L\");", this.serviceClassName, this.serviceClientClassName);
                });

                writer.write("yield page;");
                writer.write("token = page[keyMapping.outputToken];");
                writer.write("hasNext = !!(token);");
            });
            writer.write("return undefined;");
        });
    }

    private void writeClientSideRequest(){
        writer.openBlock("const makePagedClientRequest = async (client: $L, input: $L, ...additionalArguments: any): Promise<$L> => {", "}", this.serviceClientClassName, this.commandInput, this.commandOutput, () -> {
            writer.write("// @ts-ignore");
            writer.write("return await client.send(new $L(input, ...additionalArguments));", this.operationSymbol.getName());
        });
    }

    private void writeFullRequest(){
        writer.openBlock("const makePagedRequest = async (client: $L, input: $L, ...additionalArguments: any): Promise<$L> => {", "}", this.serviceClassName, this.commandInput, this.commandOutput, () -> {
            writer.write("// @ts-ignore");
            writer.write("return await client.$L(input, ...additionalArguments);", this.methodName);
        });
    }

}
