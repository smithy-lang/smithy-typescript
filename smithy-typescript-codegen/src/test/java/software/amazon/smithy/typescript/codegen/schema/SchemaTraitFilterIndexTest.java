package software.amazon.smithy.typescript.codegen.schema;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.traits.EndpointTrait;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.model.traits.EventHeaderTrait;
import software.amazon.smithy.model.traits.EventPayloadTrait;
import software.amazon.smithy.model.traits.HostLabelTrait;
import software.amazon.smithy.model.traits.HttpErrorTrait;
import software.amazon.smithy.model.traits.HttpHeaderTrait;
import software.amazon.smithy.model.traits.HttpLabelTrait;
import software.amazon.smithy.model.traits.HttpPayloadTrait;
import software.amazon.smithy.model.traits.HttpPrefixHeadersTrait;
import software.amazon.smithy.model.traits.HttpQueryParamsTrait;
import software.amazon.smithy.model.traits.HttpQueryTrait;
import software.amazon.smithy.model.traits.HttpResponseCodeTrait;
import software.amazon.smithy.model.traits.HttpTrait;
import software.amazon.smithy.model.traits.IdempotencyTokenTrait;
import software.amazon.smithy.model.traits.JsonNameTrait;
import software.amazon.smithy.model.traits.MediaTypeTrait;
import software.amazon.smithy.model.traits.RequiresLengthTrait;
import software.amazon.smithy.model.traits.SensitiveTrait;
import software.amazon.smithy.model.traits.SparseTrait;
import software.amazon.smithy.model.traits.StreamingTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.model.traits.XmlAttributeTrait;
import software.amazon.smithy.model.traits.XmlFlattenedTrait;
import software.amazon.smithy.model.traits.XmlNameTrait;
import software.amazon.smithy.model.traits.XmlNamespaceTrait;
import software.amazon.smithy.typescript.codegen.knowledge.SerdeElisionIndexTest;
import software.amazon.smithy.utils.SetUtils;

class SchemaTraitFilterIndexTest {

    private static Model model;
    private static SchemaTraitFilterIndex subject;

    @BeforeAll
    public static void before() {
        model = Model.assembler()
            .addImport(SerdeElisionIndexTest.class.getResource("serde-elision.smithy"))
            .assemble()
            .unwrap();
        subject = new SchemaTraitFilterIndex(model);
    }

    @Test
    void hasSchemaTraits() {
        Set<Shape> sparseShapes = model.getShapesWithTrait(SparseTrait.class);
        assertFalse(sparseShapes.isEmpty());

        for (Shape sparseShape : sparseShapes) {
            assertTrue(subject.hasSchemaTraits(sparseShape));
            assertTrue(subject.includeTrait(sparseShape.getTrait(SparseTrait.class).get().toShapeId()));
        }
    }

    @Test
    void includeTrait() {
        Set<ShapeId> excludedShapes = SetUtils.of(TimestampFormatTrait.ID);
        for (ShapeId excludedShape : excludedShapes) {
            String presence = subject.includeTrait(excludedShape) ? "should not be included" : excludedShape.getName();
            assertEquals(excludedShape.getName(), presence);
        }
        Set<ShapeId> includedTraits = SetUtils.of(
            SparseTrait.ID,
            SensitiveTrait.ID,
            IdempotencyTokenTrait.ID,
            JsonNameTrait.ID,
            MediaTypeTrait.ID,
            XmlAttributeTrait.ID,
            XmlFlattenedTrait.ID,
            XmlNameTrait.ID,
            XmlNamespaceTrait.ID,
            EventHeaderTrait.ID,
            EventPayloadTrait.ID,
            StreamingTrait.ID,
            RequiresLengthTrait.ID,
            EndpointTrait.ID,
            HttpErrorTrait.ID,
            HttpHeaderTrait.ID,
            HttpQueryTrait.ID,
            HttpLabelTrait.ID,
            HttpPayloadTrait.ID,
            HttpPrefixHeadersTrait.ID,
            HttpQueryParamsTrait.ID,
            HttpResponseCodeTrait.ID,
            HostLabelTrait.ID,
            ErrorTrait.ID,
            HttpTrait.ID
        );
        for (ShapeId includedTrait : includedTraits) {
            String presence = subject.includeTrait(includedTrait) ? includedTrait.getName() : "is missing";
            assertEquals(includedTrait.getName(), presence);
        }
    }
}
