package software.amazon.smithy.typescript.codegen.schema;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.traits.StreamingTrait;
import software.amazon.smithy.typescript.codegen.knowledge.SerdeElisionIndexTest;
import software.amazon.smithy.typescript.codegen.util.StringStore;

class SchemaTraitWriterTest {

    private static Model model;
    private static SchemaReferenceIndex schemaReferenceIndex;
    private static SchemaTraitWriter subject;

    @BeforeAll
    public static void before() {
        model = Model.assembler()
            .addImport(SerdeElisionIndexTest.class.getResource("serde-elision.smithy"))
            .assemble()
            .unwrap();
        schemaReferenceIndex = new SchemaReferenceIndex(model);
        subject = new SchemaTraitWriter(null, schemaReferenceIndex, new StringStore());
    }

    @Test
    void testToString() {
        Set<Shape> streamingShapes = model.getShapesWithTrait(StreamingTrait.class);
        assertEquals(1, streamingShapes.size());
        for (Shape streamingShape : streamingShapes) {
            subject = new SchemaTraitWriter(streamingShape, schemaReferenceIndex, new StringStore());
            String codeGeneration = subject.toString();
            assertEquals(
                """
                { [_s]: 1 }""",
                codeGeneration
            );
        }
    }
}
