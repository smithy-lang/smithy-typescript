package software.amazon.smithy.typescript.codegen.knowledge;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.SetShape;
import software.amazon.smithy.model.shapes.ShapeId;

public class SerdeElisionIndexTest {
    private static Model model;

    @BeforeAll
    public static void before() {
        model = Model.assembler()
                .addImport(SerdeElisionIndexTest.class.getResource("serde-elision.smithy"))
                .assemble()
                .unwrap();
    }

    @AfterAll
    public static void after() {
        model = null;
    }

    @Test
    public void mayElideSimpleObjects() {
        SerdeElisionIndex index = SerdeElisionIndex.of(model);

        assertTrue(index.mayElide(model.getShape(ShapeId.from("foo.bar#SimpleString")).get()));
        assertTrue(index.mayElide(model.getShape(ShapeId.from("foo.bar#SimpleList")).get()));
        assertTrue(index.mayElide(model.getShape(ShapeId.from("foo.bar#SimpleMap")).get()));
        assertTrue(index.mayElide(model.getShape(ShapeId.from("foo.bar#SimpleStruct")).get()));
        assertTrue(index.mayElide(model.getShape(ShapeId.from("foo.bar#Boolean")).get()));
        assertTrue(index.mayElide(model.getShape(ShapeId.from("foo.bar#Byte")).get()));
        assertTrue(index.mayElide(model.getShape(ShapeId.from("foo.bar#Enum")).get()));
        assertTrue(index.mayElide(model.getShape(ShapeId.from("foo.bar#Integer")).get()));
        assertTrue(index.mayElide(model.getShape(ShapeId.from("foo.bar#IntEnum")).get()));
        assertTrue(index.mayElide(model.getShape(ShapeId.from("foo.bar#Long")).get()));
        assertTrue(index.mayElide(model.getShape(ShapeId.from("foo.bar#Short")).get()));
        assertTrue(index.mayElide(model.getShape(ShapeId.from("foo.bar#SimpleStruct")).get()));
    }

    @Test
    public void cannotElideUnsupportedTypes() {
        SerdeElisionIndex index = SerdeElisionIndex.of(model);

        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#BigDecimal")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#BigInteger")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#Blob")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#Document")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#Timestamp")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#Double")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#Float")).get()));
    }

    @Test
    public void cannotElideNestedUnsupportedTypes() {
        model = model.toBuilder().addShapes(
                // Shim set shapes into 2.0 model.
                SetShape.builder().id("foo.bar#BigDecimalSet").member(ShapeId.from("foo.bar#BigDecimal")).build(),
                SetShape.builder().id("foo.bar#BigIntegerSet").member(ShapeId.from("foo.bar#BigInteger")).build(),
                SetShape.builder().id("foo.bar#BlobSet").member(ShapeId.from("foo.bar#Blob")).build(),
                SetShape.builder().id("foo.bar#DocumentSet").member(ShapeId.from("foo.bar#Document")).build(),
                SetShape.builder().id("foo.bar#TimestampSet").member(ShapeId.from("foo.bar#Timestamp")).build(),
                SetShape.builder().id("foo.bar#DoubleSet").member(ShapeId.from("foo.bar#Double")).build(),
                SetShape.builder().id("foo.bar#FloatSet").member(ShapeId.from("foo.bar#Float")).build()
        ).build();
        SerdeElisionIndex index = SerdeElisionIndex.of(model);


        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#BigDecimalList")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#BigIntegerList")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#BlobList")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#DocumentList")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#TimestampList")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#DoubleList")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#FloatList")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#BigDecimalSet")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#BigIntegerSet")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#BlobSet")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#DocumentSet")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#TimestampSet")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#DoubleSet")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#FloatSet")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#BigDecimalStructure")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#BigIntegerStructure")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#BlobStructure")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#DocumentStructure")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#TimestampStructure")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#DoubleStructure")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#FloatStructure")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#BigDecimalUnion")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#BigIntegerUnion")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#BlobUnion")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#DocumentUnion")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#TimestampUnion")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#DoubleUnion")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#FloatUnion")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#BigDecimalMap")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#BigIntegerMap")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#BlobMap")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#DocumentMap")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#TimestampMap")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#DoubleMap")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#FloatMap")).get()));
    }

    @Test
    public void cannotElideWithMutatingTraits() {
        SerdeElisionIndex index = SerdeElisionIndex.of(model);

        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#NestedJsonName")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#JsonNameStructure")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#JsonNameStructure$foo")).get()));

        // Blobs are incompatible types, so we only need to check for @streaming traits on unions.
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#NestedEventStream")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#EventStreamUnion")).get()));

        // Blobs are incompatible types, so we only need to check for @mediaType traits on strings.
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#NestedMediaType")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#MediaTypeString")).get()));

        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#NestedSparseList")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#SparseList")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#NestedSparseMap")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#SparseMap")).get()));

        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#NestedIdempotencyToken")).get()));
        assertFalse(index.mayElide(model.getShape(ShapeId.from("foo.bar#IdempotencyTokenStructure")).get()));
    }
}
