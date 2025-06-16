package software.amazon.smithy.typescript.codegen.schema;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Stream;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.SimpleShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.typescript.codegen.knowledge.SerdeElisionIndexTest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;

class SchemaReferenceIndexTest {
    private static Model model;
    private static SchemaReferenceIndex subject;

    @BeforeAll
    public static void before() {
        model = Model.assembler()
            .addImport(SerdeElisionIndexTest.class.getResource("serde-elision.smithy"))
            .assemble()
            .unwrap();
        subject = new SchemaReferenceIndex(model);
    }

    @Test
    void isReferenceSchema() {
        Stream<? extends SimpleShape> simpleShapes = Stream.of(
            model.getStringShapes().stream(),
            model.getBooleanShapes().stream(),
            model.getByteShapes().stream(),
            model.getDoubleShapes().stream(),
            model.getFloatShapes().stream(),
            model.getShortShapes().stream(),
            model.getIntegerShapes().stream(),
            model.getLongShapes().stream(),
            model.getEnumShapes().stream(),
            model.getIntEnumShapes().stream(),
            model.getBigIntegerShapes().stream(),
            model.getBigDecimalShapes().stream(),
            model.getTimestampShapes().stream(),
            model.getBlobShapes().stream(),
            model.getDocumentShapes().stream()
        ).flatMap(Function.identity());
        simpleShapes.forEach(booleanShape -> {
            assertFalse(subject.isReferenceSchema(booleanShape));
        });

        Set<StructureShape> structureShapes = model.getStructureShapes();
        structureShapes.forEach(structureShape -> {
            assertTrue(subject.isReferenceSchema(structureShape));
        });

        Stream<? extends Shape> collectionShapes = Stream.of(
            model.getSetShapes().stream(),
            model.getListShapes().stream(),
            model.getMapShapes().stream()
        ).flatMap(Function.identity());
        collectionShapes.forEach(shape -> {
            boolean isRef;
            if (shape instanceof CollectionShape collection) {
                isRef = subject.isReferenceSchema(collection.getMember());
            } else if (shape instanceof MapShape map) {
                isRef =  subject.isReferenceSchema(map.getValue());
            } else {
                throw new UnsupportedOperationException("Unexpected shape type");
            }
            assertEquals(isRef, subject.isReferenceSchema(shape));
        });
    }
}