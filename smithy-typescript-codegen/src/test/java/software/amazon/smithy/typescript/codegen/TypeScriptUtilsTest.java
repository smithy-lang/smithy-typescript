package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

import java.util.Arrays;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.shapes.ShapeId;

public class TypeScriptUtilsTest {
    @Test
    public void sanitizesPropertyNames() {
        assertThat(TypeScriptUtils.sanitizePropertyName("foo"), equalTo("foo"));
        assertThat(TypeScriptUtils.sanitizePropertyName("$foo"), equalTo("$foo"));
        assertThat(TypeScriptUtils.sanitizePropertyName("_Foo"), equalTo("_Foo"));
        assertThat(TypeScriptUtils.sanitizePropertyName("_Foo.bar"), equalTo("\"_Foo.bar\""));
        assertThat(TypeScriptUtils.sanitizePropertyName("!foo"), equalTo("\"!foo\""));
        assertThat(TypeScriptUtils.sanitizePropertyName("foo?"), equalTo("\"foo?\""));
    }

    @Test
    public void createsEnumVariantsFromString() {
        assertThat(TypeScriptUtils.getEnumVariants(Arrays.asList("foo", "bar")), equalTo("\"foo\" | \"bar\""));
        assertThat(TypeScriptUtils.getEnumVariants(Arrays.asList("foo!!")), equalTo("\"foo!!\""));
        assertThat(TypeScriptUtils.getEnumVariants(Arrays.asList("foo\"", "bar")), equalTo("\"foo\\\"\" | \"bar\""));
    }

    @Test
    public void convertsShapeIdsToModuleNames() {
        assertThat(TypeScriptUtils.formatModuleName(ShapeId.from("foo.baz#Bar")), equalTo("foo/baz"));
    }
}
