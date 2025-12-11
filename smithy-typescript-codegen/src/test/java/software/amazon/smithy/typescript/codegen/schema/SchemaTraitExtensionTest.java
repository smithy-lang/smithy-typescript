package software.amazon.smithy.typescript.codegen.schema;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.traits.JsonNameTrait;

class SchemaTraitExtensionTest {

    private static final SchemaTraitExtension subject = SchemaTraitExtension.INSTANCE;

    @Test
    void add() {
        subject.add(JsonNameTrait.ID, Object::toString);
    }

    @Test
    void contains() {
        subject.add(JsonNameTrait.ID, Object::toString);
        assertTrue(subject.contains(JsonNameTrait.ID));
        JsonNameTrait trait = new JsonNameTrait("test");
        assertTrue(subject.contains(trait));
    }

    @Test
    void render() {
        JsonNameTrait trait = new JsonNameTrait("test");
        subject.add(JsonNameTrait.ID, _trait -> {
            if (_trait instanceof JsonNameTrait jsonNameTrait) {
                return jsonNameTrait.getValue() + "__test";
            }
            throw new UnsupportedOperationException("wrong trait type");
        });
        assertEquals("test__test", subject.render(trait));
    }
}
