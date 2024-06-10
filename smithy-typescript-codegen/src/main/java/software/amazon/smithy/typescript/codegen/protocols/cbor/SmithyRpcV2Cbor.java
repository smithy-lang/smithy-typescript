/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.protocols.cbor;

import java.util.Set;
import java.util.TreeSet;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.protocol.traits.Rpcv2CborTrait;
import software.amazon.smithy.typescript.codegen.SmithyCoreSubmodules;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.EventStreamGenerator;
import software.amazon.smithy.typescript.codegen.integration.HttpProtocolGeneratorUtils;
import software.amazon.smithy.typescript.codegen.integration.HttpRpcProtocolGenerator;
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

        writer.addSubPathImport("parseCborBody", "parseBody",
            TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CBOR);
        writer.addSubPathImport("parseCborErrorBody", "parseErrorBody",
            TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CBOR);
        writer.addSubPathImport("loadSmithyRpcV2CborErrorCode", null,
            TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CBOR);

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
        writer.openBlock("""
            const buildHttpRpcRequest = async (
              context: __SerdeContext,
              headers: __HeaderBag,
              path: string,
              resolvedHostname: string | undefined,
              body: any,
            ): Promise<$T> => {""", "};", requestType, () -> {
                writer.addImport("calculateBodyLength", null, TypeScriptDependency.AWS_SDK_UTIL_BODY_LENGTH_BROWSER);
                writer.write("""
                    const { hostname, protocol = "https", port, path: basePath } = await context.endpoint();
                    const contents: any = {
                      protocol,
                      hostname,
                      port,
                      method: "POST",
                      path: basePath.endsWith("/") ? basePath.slice(0, -1) + path : basePath + path,
                      headers,
                    };
                    if (resolvedHostname !== undefined) {
                      contents.hostname = resolvedHostname;
                    }
                    if (body !== undefined) {
                      contents.body = body;
                      try {
                        contents.headers["content-length"] = String(calculateBodyLength(body));
                      } catch (e) {}
                    }
                    return new $T(contents);
                    """,
                    requestType
                );
            }
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
    protected String getOperationPath(GenerationContext generationContext, OperationShape operationShape) {
        // TODO(cbor) what is the prefix?
        String prefix = "";

        TypeScriptSettings settings = generationContext.getSettings();
        Model model = generationContext.getModel();
        ServiceShape service = settings.getService(model);

        String serviceName = service.getId().getName();
        String operationName = operationShape.getId().getName();

        return "%s/service/%s/operation/%s".formatted(prefix, serviceName, operationName);
    }

    @Override
    protected void serializeInputDocument(GenerationContext generationContext,
                                          OperationShape operationShape,
                                          StructureShape inputStructure) {
        TypeScriptWriter writer = generationContext.getWriter();

        writer.addSubPathImport(
            "cbor", null,
            TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CBOR
        );
        writer.write("body = cbor.serialize($L);", inputStructure.accept(
            new CborMemberSerVisitor(generationContext, "input", getDocumentTimestampFormat()))
        );
    }

    @Override
    protected void writeErrorCodeParser(GenerationContext generationContext) {
        TypeScriptWriter writer = generationContext.getWriter();

        // TODO(cbor) handle Query-Compatible
        // TODO(cbor) either by accepting a function from downstream
        // TODO(cbor) or natively here.

        writer.addSubPathImport(
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
                "data",
                getDocumentTimestampFormat()
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

    protected TimestampFormatTrait.Format getDocumentTimestampFormat() {
        return TimestampFormatTrait.Format.EPOCH_SECONDS;
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
