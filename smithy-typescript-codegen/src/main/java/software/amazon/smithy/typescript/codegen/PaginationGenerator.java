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

import java.util.ArrayList;
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
    private String paginationType;
    private String interfaceLocation;

    PaginationGenerator(TypeScriptSettings settings,
                        Model model,
                        OperationShape operation,
                        SymbolProvider symbolProvider,
                        TypeScriptWriter writer,
                        List<RuntimeClientPlugin> runtimePlugins,
                        ProtocolGenerator protocolGenerator,
                        ApplicationProtocol applicationProtocol,
                        String nonModularServiceName,
                        String interfaceLocation){

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

        String operationName = operation.getId().getName();

        this.serviceSymbol = symbolProvider.toSymbol(service);
        this.operationSymbol = symbolProvider.toSymbol(operation);
        this.inputSymbol = symbolProvider.toSymbol(operation).expectProperty("inputType", Symbol.class);
        this.outputSymbol = symbolProvider.toSymbol(operation).expectProperty("outputType", Symbol.class);


        this.nonModularServiceName = nonModularServiceName;
        this.methodName = Character.toLowerCase(operationName.charAt(0)) + operationName.substring(1); // e.g. listObjects
        this.paginationType = this.nonModularServiceName + "PaginationConfiguration";
        this.interfaceLocation = interfaceLocation;

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
        writer.addImport("Paginator", "Paginator", "@aws-sdk/types");
        writer.addImport(this.paginationType, this.paginationType, "./" + this.interfaceLocation.replace(".ts", ""));

        this.writeClientSideRequest();
        this.writeFullRequest();
        this.writePaginator();
    }
    public static void generateServicePaginationInterfaces(String nonModularServiceName, Symbol service, TypeScriptWriter writer){
        writer.addImport("PaginationConfiguration", "PaginationConfiguration", "@aws-sdk/types");
        writer.addImport(nonModularServiceName, nonModularServiceName, service.getNamespace().replace(service.getName(), nonModularServiceName));
        writer.addImport(service.getName(), service.getName(), service.getNamespace());

        writer.openBlock("export interface $LPaginationConfiguration extends PaginationConfiguration {", "}", nonModularServiceName, () -> {
            writer.write("client: $L | $L;", nonModularServiceName, service.getName());
        });
    }

    private void writePaginator(){
        writer.openBlock("export async function* $LPaginate(config: $L, input: $L, ...additionalArguments: any): Paginator<$L>{", "}", this.methodName, this.paginationType, this.inputSymbol.getName(), this.outputSymbol.getName(), () -> {
            writer.write("let token = config.startingToken || '';");

            writer.write("let hasNext = true;");
            writer.write("let page:$L;", this.outputSymbol.getName());
            writer.openBlock("while (hasNext) {", "}", () -> {
                writer.write("input[\"$L\"] = token;", this.paginatedInfo.getInputTokenMember().getMemberName());
                if (this.paginatedInfo.getPageSizeMember().isPresent()){
                    writer.write("input[\"$L\"] = config.pageSize;", this.paginatedInfo.getPageSizeMember().get().getMemberName());
                }

                writer.openBlock("if(config.client instanceof $L) {", "}", this.nonModularServiceName, () -> {
                    writer.write("page = await makePagedRequest(config.client, input, ...additionalArguments);");
                });
                writer.openBlock("else if (config.client instanceof $L) {", "}", this.serviceSymbol.getName(), () -> {
                    writer.write(" page = await makePagedClientRequest(config.client, input, ...additionalArguments);");
                });
                writer.openBlock("else {", "}", () -> {
                    writer.write(" throw new Error(\"Invalid client, expected $L | $L\");", this.nonModularServiceName, this.serviceSymbol.getName());
                });

                writer.write("yield page;");
                if (this.paginatedInfo.getOutputTokenMember().getMemberName().contains(".")){
                    // Smithy allows one level indexing (ex. 'bucket.outputToken').
                    String[] outputIndex = this.paginatedInfo.getOutputTokenMember().getMemberName().split(".");
                    writer.write("token = page[\"$L\"][\"$L\"];", outputIndex[0], outputIndex[1]);

                } else {
                    writer.write("token = page[\"$L\"];", paginatedInfo.getOutputTokenMember().getMemberName());
                }

                writer.write("hasNext = !!(token);");
            });
            writer.write("return undefined;");
        });
    }


    private void writeFullRequest(){
        writer.openBlock("const makePagedRequest = async (client: $L, input: $L, ...additionalArguments: any): Promise<$L> => {", "}", this.nonModularServiceName, this.inputSymbol.getName(), this.outputSymbol.getName(), () -> {
            writer.write("// @ts-ignore");
            writer.write("return await client.$L(input, ...additionalArguments);", this.methodName);
        });
    }

    private void writeClientSideRequest(){
        writer.openBlock("const makePagedClientRequest = async (client: $L, input: $L, ...additionalArguments: any): Promise<$L> => {", "}", this.serviceSymbol.getName(), this.inputSymbol.getName(), this.outputSymbol.getName(), () -> {
            writer.write("// @ts-ignore");
            writer.write("return await client.send(new $L(input, ...additionalArguments));", this.operationSymbol.getName());
        });
    }
}
