package software.amazon.smithy.typescript.ssdk.codegen.test.utils;

import java.util.List;
import java.util.Set;
import software.amazon.smithy.model.knowledge.HttpBinding;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.TimestampFormatTrait.Format;
import software.amazon.smithy.typescript.codegen.integration.HttpBindingProtocolGenerator;
import software.amazon.smithy.utils.SmithyInternalApi;


 /**
  * Fake protocol for SSDK codegen testing.
  */
@SmithyInternalApi
public class FakeProtocolGenerator extends HttpBindingProtocolGenerator {

    FakeProtocolGenerator() {
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
    ) {}

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
    public void writeErrorCodeParser(GenerationContext context) {}

    @Override
    public void generateProtocolTests(GenerationContext context) {}
}
