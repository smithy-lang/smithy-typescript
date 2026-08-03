/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.protocols.sse;

import java.util.List;
import java.util.Set;
import software.amazon.smithy.model.knowledge.HttpBinding;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.TimestampFormatTrait.Format;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.HttpBindingProtocolGenerator;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Generates an HTTP protocol whose event streams are framed as Server-Sent
 * Events (text/event-stream) rather than the binary vnd.amazon.eventstream
 * encoding. Document body serde for non-streaming members is not yet
 * implemented; only HTTP bindings and event stream payloads are supported.
 */
@SmithyUnstableApi
public final class SseJsonProtocolGenerator extends HttpBindingProtocolGenerator {

    public SseJsonProtocolGenerator() {
        super(true);
    }

    @Override
    public ShapeId getProtocol() {
        return SseJsonTrait.ID;
    }

    @Override
    public String getEventStreamSerdeProviderName() {
        return "sseEventStreamSerdeProvider";
    }

    @Override
    protected String getDocumentContentType() {
        return "application/json";
    }

    @Override
    protected Format getDocumentTimestampFormat() {
        return Format.EPOCH_SECONDS;
    }

    @Override
    protected boolean requiresNumericEpochSecondsInPayload() {
        return true;
    }

    @Override
    protected void serializeInputDocumentBody(
        GenerationContext context,
        OperationShape operation,
        List<HttpBinding> documentBindings
    ) {
        context.getWriter().write("body = \"{}\";");
    }

    @Override
    protected void serializeOutputDocumentBody(
        GenerationContext context,
        OperationShape operation,
        List<HttpBinding> documentBindings
    ) {
        context.getWriter().write("body = \"{}\";");
    }

    @Override
    protected void serializeErrorDocumentBody(
        GenerationContext context,
        StructureShape error,
        List<HttpBinding> documentBindings
    ) {
        context.getWriter().write("body = \"{}\";");
    }

    @Override
    protected void serializeInputEventDocumentPayload(GenerationContext context) {}

    @Override
    protected void deserializeInputDocumentBody(
        GenerationContext context,
        OperationShape operation,
        List<HttpBinding> documentBindings
    ) {}

    @Override
    protected void deserializeOutputDocumentBody(
        GenerationContext context,
        OperationShape operation,
        List<HttpBinding> documentBindings
    ) {}

    @Override
    protected void deserializeErrorDocumentBody(
        GenerationContext context,
        StructureShape error,
        List<HttpBinding> documentBindings
    ) {}

    @Override
    protected void generateDocumentBodyShapeSerializers(GenerationContext context, Set<Shape> shapes) {}

    @Override
    protected void generateDocumentBodyShapeDeserializers(GenerationContext context, Set<Shape> shapes) {}

    @Override
    protected void writeErrorCodeParser(GenerationContext context) {
        context.getWriter().write("const errorCode = parseErrorCode(output, parsedOutput.body);");
    }

    @Override
    public void generateProtocolTests(GenerationContext context) {}

    @Override
    public void generateSharedComponents(GenerationContext context) {
        super.generateSharedComponents(context);

        TypeScriptWriter writer = context.getWriter();
        writer.addImport("SerdeContext", "__SerdeContext", TypeScriptDependency.SMITHY_TYPES);
        writer.openBlock(
            "const parseBody = (streamBody: any, context: __SerdeContext): "
                + "any => collectBodyString(streamBody, context).then(encoded => {",
            "});",
            () -> {
                writer.openBlock("if (encoded.length) {", "}", () -> {
                    writer.write("return JSON.parse(encoded);");
                });
                writer.write("return {};");
            }
        );
        writer.write("");
        writer.openBlock("const parseErrorBody = async (errorBody: any, context: __SerdeContext) => {", "}", () -> {
            writer.write("const value = await parseBody(errorBody, context);");
            writer.write("value.message = value.message ?? value.Message;");
            writer.write("return value;");
        });
        writer.write("");
        writer.openBlock(
            "const parseErrorCode = (output: __HttpResponse, data: any): string | undefined => {",
            "}",
            () -> {
                writer.openBlock("if (output.headers[\"x-error\"]) {", "}", () -> {
                    writer.write("return output.headers[\"x-error\"];");
                });
                writer.openBlock("if (data.code !== undefined) {", "}", () -> {
                    writer.write("return data.code;");
                });
            }
        );
    }
}
