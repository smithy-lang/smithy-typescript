package software.amazon.smithy.typescript.ssdk.codegen.test.utils;

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
import software.amazon.smithy.utils.SmithyInternalApi;


 /**
  * Protocol for SSDK codegen testing.
  */
@SmithyInternalApi
class TestProtocolGenerator extends HttpBindingProtocolGenerator {

    TestProtocolGenerator() {
        super(true);
    }

    @Override
    public ShapeId getProtocol() {
        return ShapeId.from("example.weather#fakeProtocol");
    }

    @Override
    public String getName() {
        return "fakeProtocol";
    }

    @Override
    protected String getDocumentContentType() {
        return "application/json";
    }

    @Override
    public Format getDocumentTimestampFormat() {
        return Format.EPOCH_SECONDS;
    }

    @Override
    public boolean requiresNumericEpochSecondsInPayload() {
        return true;
    }

    @Override
    public boolean enableSerdeElision() {
        return true;
    }

    @Override
    public void deserializeErrorDocumentBody(
            GenerationContext context,
            StructureShape error,
            List<HttpBinding> documentBindings
    ) {}

    @Override
    public void serializeErrorDocumentBody(
            GenerationContext context,
            StructureShape error,
            List<HttpBinding> documentBindings
    ) {}

    @Override
    public void deserializeInputDocumentBody(
            GenerationContext context,
            OperationShape operation,
            List<HttpBinding> documentBindings
    ) {}

    @Override
    public void serializeInputDocumentBody(
            GenerationContext context,
            OperationShape operation,
            List<HttpBinding> documentBindings
    ) {
        TypeScriptWriter writer = context.getWriter();
        writer.write("body = \"{}\"");
    }

    @Override
    public void deserializeOutputDocumentBody(
            GenerationContext context,
            OperationShape error,
            List<HttpBinding> documentBindings
    ) {}

    @Override
    public void serializeOutputDocumentBody(
            GenerationContext context,
            OperationShape error,
            List<HttpBinding> documentBindings
    ) {}

    @Override
    public void serializeInputEventDocumentPayload(GenerationContext context) {}

    @Override
    public void generateDocumentBodyShapeSerializers(GenerationContext context, Set<Shape> shapes) {}

    @Override
    public void generateDocumentBodyShapeDeserializers(GenerationContext context, Set<Shape> shapes) {}

    @Override
    public void writeErrorCodeParser(GenerationContext context) {
        TypeScriptWriter writer = context.getWriter();
        writer.write("const errorCode = parseErrorCode(output, parsedOutput.body);");
    }

    @Override
    public void generateProtocolTests(GenerationContext context) {}

    @Override
    public void generateSharedComponents(GenerationContext context) {
        super.generateSharedComponents(context);

        TypeScriptWriter writer = context.getWriter();

        // Include a JSON body parser used to deserialize documents from HTTP responses.
        writer.addImport("SerdeContext", "__SerdeContext", TypeScriptDependency.SMITHY_TYPES);
        writer.openBlock("const parseBody = (streamBody: any, context: __SerdeContext): "
                + "any => collectBodyString(streamBody, context).then(encoded => {", "});", () -> {
                    writer.openBlock("if (encoded.length) {", "}", () -> {
                        writer.write("return JSON.parse(encoded);");
                    });
                    writer.write("return {};");
                });
        writer.write("");

        // Include a JSON body parser.
        writer.addImport("SerdeContext", "__SerdeContext", TypeScriptDependency.SMITHY_TYPES);
        writer.openBlock("const parseErrorBody = async (errorBody: any, context: __SerdeContext) => {",
                "}", () -> {
                    writer.write("const value = await parseBody(errorBody, context);");
                    writer.write("value.message = value.message ?? value.Message;");
                    writer.write("return value;");
                });
        writer.write("");

        // Include an error code parser.
        writer.openBlock("const parseErrorCode = (output: __HttpResponse, data: any): string | undefined => {",
                "}", () -> {
                    writer.openBlock("if (output.headers[\"x-error\"]) {", "}", () -> {
                        writer.write("return output.headers[\"x-error\"];");
                    });
                    writer.openBlock("if (data.code !== undefined) {", "}", () -> {
                        writer.write("return data.code;");
                    });
                });
    }
}
