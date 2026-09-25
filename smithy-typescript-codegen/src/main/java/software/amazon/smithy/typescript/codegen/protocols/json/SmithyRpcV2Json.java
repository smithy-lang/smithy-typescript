/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.protocols.json;

import java.util.Set;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.protocol.traits.Rpcv2JsonTrait;
import software.amazon.smithy.typescript.codegen.SmithyCoreSubmodules;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.EventStreamGenerator;
import software.amazon.smithy.typescript.codegen.integration.HttpRpcProtocolGenerator;
import software.amazon.smithy.typescript.codegen.protocols.SmithyProtocolUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generator for Smithy RPCv2 JSON.
 *
 * <p>This is the classic (non-schema) protocol generator, parallel to
 * {@link software.amazon.smithy.typescript.codegen.protocols.cbor.SmithyRpcV2Cbor}.
 * It reuses the shared RPC request/response scaffolding from
 * {@link HttpRpcProtocolGenerator} and supplies the JSON-specific wire behavior:
 * {@code application/json} content type, the {@code rpc-v2-json} marker header,
 * {@code JSON.stringify} request bodies, and JSON error-code loading.
 *
 * @see JsonRpcShapeSerVisitor
 * @see JsonRpcShapeDeserVisitor
 * @see JsonRpcMemberSerVisitor
 * @see JsonRpcMemberDeserVisitor
 * @see SmithyProtocolUtils
 */
@SmithyInternalApi
public class SmithyRpcV2Json extends HttpRpcProtocolGenerator {

    public SmithyRpcV2Json() {
        super(true);
    }

    @Override
    public void generateSharedComponents(GenerationContext context) {
        // Import the JSON body/error parsing helpers under the generic names the
        // shared RPC scaffolding emits (parseBody / parseErrorBody).
        TypeScriptWriter writer = context.getWriter();
        writer
            .addImportSubmodule(
                "parseJsonBody",
                "parseBody",
                TypeScriptDependency.SMITHY_CORE,
                SmithyCoreSubmodules.PROTOCOLS
            )
            .addImportSubmodule(
                "parseJsonErrorBody",
                "parseErrorBody",
                TypeScriptDependency.SMITHY_CORE,
                SmithyCoreSubmodules.PROTOCOLS
            )
            .addImportSubmodule(
                "loadJsonRpcErrorCode",
                null,
                TypeScriptDependency.SMITHY_CORE,
                SmithyCoreSubmodules.PROTOCOLS
            );

        super.generateSharedComponents(context);
    }

    @Override
    public ShapeId getProtocol() {
        return Rpcv2JsonTrait.ID;
    }

    @Override
    public void generateProtocolTests(GenerationContext generationContext) {
        SmithyProtocolUtils.generateProtocolTests(this, generationContext);
    }

    @Override
    protected String getDocumentContentType() {
        return "application/json";
    }

    @Override
    protected void generateDocumentBodyShapeSerializers(GenerationContext generationContext, Set<Shape> shapes) {
        SmithyProtocolUtils.generateDocumentBodyShapeSerde(
            generationContext,
            shapes,
            new JsonRpcShapeSerVisitor(generationContext)
        );
    }

    @Override
    protected void generateDocumentBodyShapeDeserializers(GenerationContext generationContext, Set<Shape> shapes) {
        SmithyProtocolUtils.generateDocumentBodyShapeSerde(
            generationContext,
            shapes,
            new JsonRpcShapeDeserVisitor(generationContext)
        );
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
    protected void serializeInputDocument(
        GenerationContext generationContext,
        OperationShape operationShape,
        StructureShape inputStructure
    ) {
        TypeScriptWriter writer = generationContext.getWriter();

        writer.write(
            "body = JSON.stringify($L);",
            inputStructure.accept(new JsonRpcMemberSerVisitor(generationContext, "input"))
        );
    }

    @Override
    protected void writeErrorCodeParser(GenerationContext generationContext) {
        TypeScriptWriter writer = generationContext.getWriter();

        writer.addImportSubmodule(
            "loadJsonRpcErrorCode",
            null,
            TypeScriptDependency.SMITHY_CORE,
            SmithyCoreSubmodules.PROTOCOLS
        );
        writer.write("const errorCode = loadJsonRpcErrorCode(output, parsedOutput.body);");
    }

    @Override
    protected void deserializeOutputDocument(
        GenerationContext generationContext,
        OperationShape operationShape,
        StructureShape outputStructure
    ) {
        TypeScriptWriter writer = generationContext.getWriter();

        writer.write(
            "contents = $L;",
            outputStructure.accept(new JsonRpcMemberDeserVisitor(generationContext, "data"))
        );
    }

    @Override
    protected void writeSharedRequestHeaders(GenerationContext context) {
        TypeScriptWriter writer = context.getWriter();
        writer.addTypeImport("HeaderBag", "__HeaderBag", TypeScriptDependency.SMITHY_TYPES);
        writer.openBlock("const SHARED_HEADERS: __HeaderBag = {", "};", () -> {
            writer.write("'content-type': $S,", getDocumentContentType());
            writer.write(
                """
                "smithy-protocol": "rpc-v2-json",
                "accept": "application/json",
                """
            );
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
            writer.write(
                """
                headers.accept = "application/vnd.amazon.eventstream";
                """
            );
        }
        if (hasEventStreamInput) {
            writer.write(
                """
                headers["content-type"] = "application/vnd.amazon.eventstream";
                """
            );
        } else if (inputIsEmpty) {
            writer.write(
                """
                delete headers["content-type"];
                """
            );
        }
    }
}
