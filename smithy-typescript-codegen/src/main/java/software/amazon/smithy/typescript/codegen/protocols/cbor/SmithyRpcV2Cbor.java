/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.protocols.cbor;

import java.util.Set;
import java.util.TreeSet;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.protocol.traits.Rpcv2CborTrait;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.SmithyCoreSubmodules;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.EventStreamGenerator;
import software.amazon.smithy.typescript.codegen.integration.HttpProtocolGeneratorUtils;
import software.amazon.smithy.typescript.codegen.integration.HttpRpcProtocolGenerator;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.typescript.codegen.knowledge.SerdeElisionIndex;
import software.amazon.smithy.typescript.codegen.protocols.SmithyProtocolUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generator for Smithy RPCv2 CBOR.
 *
 * @see CborShapeSerVisitor
 * @see CborShapeDeserVisitor
 * @see CborMemberSerVisitor
 * @see CborMemberDeserVisitor
 * @see SmithyProtocolUtils
 */
@SmithyInternalApi
public class SmithyRpcV2Cbor extends HttpRpcProtocolGenerator {

    public SmithyRpcV2Cbor() {
        super(true);
    }

    @Override
    public void generateSharedComponents(GenerationContext context) {
        TypeScriptWriter writer = context.getWriter();

        writer.addImportSubmodule("parseCborBody", "parseBody",
                TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CBOR
            )
            .addImportSubmodule("parseCborErrorBody", "parseErrorBody",
                TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CBOR
            )
            .addImportSubmodule("loadSmithyRpcV2CborErrorCode", null,
                TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CBOR
            );

        ServiceShape service = context.getService();
        deserializingErrorShapes.forEach(error -> generateErrorDeserializer(context, error));
        eventStreamGenerator.generateEventStreamSerializers(
            context,
            service,
            getDocumentContentType(),
            () -> {
                writer.write("body = context.utf8Decoder(body);");
            },
            serializingDocumentShapes
        );
        Set<StructureShape> errorEventShapes = new TreeSet<>();
        SerdeElisionIndex serdeElisionIndex = SerdeElisionIndex.of(context.getModel());
        eventStreamGenerator.generateEventStreamDeserializers(
            context,
            service,
            errorEventShapes,
            deserializingDocumentShapes,
            true,
            enableSerdeElision(),
            serdeElisionIndex
        );
        errorEventShapes.removeIf(deserializingErrorShapes::contains);
        errorEventShapes.forEach(error -> generateErrorDeserializer(context, error));
        generateDocumentBodyShapeSerializers(context, serializingDocumentShapes);
        generateDocumentBodyShapeDeserializers(context, deserializingDocumentShapes);

        SymbolReference requestType = getApplicationProtocol().getRequestType();
        SymbolReference responseType = getApplicationProtocol().getResponseType();

        HttpProtocolGeneratorUtils.generateMetadataDeserializer(context, responseType);
        writer.addImport("collectBody", null, TypeScriptDependency.AWS_SMITHY_CLIENT);

        if (context.getSettings().generateClient()) {
            writer.addImport("withBaseException", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
            SymbolReference exception = HttpProtocolGeneratorUtils.getClientBaseException(context);
            writer.write("const throwDefaultError = withBaseException($T);", exception);
        }

        writer.addUseImports(requestType);
        writer.addImport("SerdeContext", "__SerdeContext", TypeScriptDependency.SMITHY_TYPES);
        writer.addImport("HeaderBag", "__HeaderBag", TypeScriptDependency.SMITHY_TYPES);
        writer.addImportSubmodule(
            "buildHttpRpcRequest", null,
            TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CBOR
        );
        writeSharedRequestHeaders(context);
        writer.write("");

        writer.write(
            context.getStringStore().flushVariableDeclarationCode()
        );
    }

    @Override
    public ShapeId getProtocol() {
        return Rpcv2CborTrait.ID;
    }

    @Override
    public void generateProtocolTests(GenerationContext generationContext) {
        SmithyProtocolUtils.generateProtocolTests(
            this, generationContext
        );
    }

    @Override
    protected String getDocumentContentType() {
        return "application/cbor";
    }

    @Override
    protected void generateDocumentBodyShapeSerializers(GenerationContext generationContext, Set<Shape> shapes) {
        SmithyProtocolUtils.generateDocumentBodyShapeSerde(
            generationContext,
            shapes,
            new CborShapeSerVisitor(
                generationContext
            )
        );
    }

    @Override
    protected void generateDocumentBodyShapeDeserializers(GenerationContext generationContext, Set<Shape> shapes) {
        SmithyProtocolUtils.generateDocumentBodyShapeSerde(
            generationContext,
            shapes,
            new CborShapeDeserVisitor(
                generationContext
            )
        );
    }

    @Override
    protected void generateOperationDeserializer(GenerationContext context, OperationShape operation) {
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(operation);
        SymbolReference responseType = getApplicationProtocol().getResponseType();
        TypeScriptWriter writer = context.getWriter();

        writer.addUseImports(responseType);
        String methodName = ProtocolGenerator.getDeserFunctionShortName(symbol);
        String methodLongName = ProtocolGenerator.getDeserFunctionName(symbol, getName());
        String errorMethodName = "de_CommandError";
        String serdeContextType = CodegenUtils.getOperationDeserializerContextType(context.getSettings(), writer,
            context.getModel(), operation);
        Symbol outputType = symbol.expectProperty("outputType", Symbol.class);

        writer.writeDocs(methodLongName);
        writer.openBlock("""
            export const $L = async(
              output: $T,
              context: $L
            ): Promise<$T> => {""", "}",
            methodName, responseType, serdeContextType, outputType,
            () -> {
                writer.addImportSubmodule(
                    "checkCborResponse", "cr",
                    TypeScriptDependency.SMITHY_CORE,
                    SmithyCoreSubmodules.CBOR
                );
                writer.write("cr(output);");

                writer.write("""
                    if (output.statusCode >= 300) {
                      return $L(output, context);
                    }
                    """,
                    errorMethodName
                );

                readResponseBody(context, operation);

                writer.write("""
                    const response: $T = {
                        $$metadata: deserializeMetadata(output), $L
                    };
                    return response;
                    """,
                    outputType,
                    operation.getOutput().map((o) -> "...contents,").orElse("")
                );
            }
        );
        writer.write("");
    }

    @Override
    protected String getOperationPath(GenerationContext generationContext, OperationShape operationShape) {
        TypeScriptSettings settings = generationContext.getSettings();
        Model model = generationContext.getModel();
        ServiceShape service = settings.getService(model);

        String serviceName = service.getId().getName();
        String operationName = operationShape.getId().getName();

        return "/service/%s/operation/%s".formatted(serviceName, operationName);
    }

    @Override
    protected void serializeInputDocument(GenerationContext generationContext,
                                          OperationShape operationShape,
                                          StructureShape inputStructure) {
        TypeScriptWriter writer = generationContext.getWriter();

        writer.addImportSubmodule(
            "cbor", null,
            TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CBOR
        );
        writer.write("body = cbor.serialize($L);", inputStructure.accept(
            new CborMemberSerVisitor(generationContext, "input"))
        );
    }

    @Override
    protected void writeErrorCodeParser(GenerationContext generationContext) {
        TypeScriptWriter writer = generationContext.getWriter();

        writer.addImportSubmodule(
            "loadSmithyRpcV2CborErrorCode", null,
            TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CBOR
        );
        writer.write("const errorCode = loadSmithyRpcV2CborErrorCode(output, parsedOutput.body);");
    }

    @Override
    protected void deserializeOutputDocument(GenerationContext generationContext,
                                             OperationShape operationShape,
                                             StructureShape outputStructure) {
        TypeScriptWriter writer = generationContext.getWriter();

        writer.write("contents = $L;", outputStructure.accept(
            new CborMemberDeserVisitor(
                generationContext,
                "data"
            )
        ));
    }

    @Override
    protected void writeSharedRequestHeaders(GenerationContext context) {
        TypeScriptWriter writer = context.getWriter();
        writer.addImport("HeaderBag", "__HeaderBag", TypeScriptDependency.SMITHY_TYPES);
        writer.openBlock("const SHARED_HEADERS: __HeaderBag = {", "};", () -> {
            writer.write("'content-type': $S,", getDocumentContentType());
            writer.write("""
                "smithy-protocol": "rpc-v2-cbor"
                """);
        });
    }

    @Override
    protected boolean enableSerdeElision() {
        return true;
    }

    @Override
    protected void writeRequestHeaders(GenerationContext context, OperationShape operation) {
        TypeScriptWriter writer = context.getWriter();

        boolean hasEventStreamOutput = EventStreamGenerator.hasEventStreamOutput(context, operation);
        boolean hasEventStreamInput = EventStreamGenerator.hasEventStreamInput(context, operation);
        boolean inputIsEmpty = operation.getInput().isEmpty();

        boolean mutatesDefaultHeader = hasEventStreamOutput | hasEventStreamInput | inputIsEmpty;

        if (mutatesDefaultHeader) {
            writer.write("const headers: __HeaderBag = { ...SHARED_HEADERS };");
        } else {
            writer.write("const headers: __HeaderBag = SHARED_HEADERS;");
        }

        if (hasEventStreamOutput) {
            writer.write("""
                headers.accept = "application/vnd.amazon.eventstream";
                """);
        }
        if (hasEventStreamInput) {
            writer.write("""
                headers["content-type"] = "application/vnd.amazon.eventstream";
                """);
        } else if (inputIsEmpty) {
            writer.write("""
                delete headers["content-type"];
                """);
        }
    }

}
