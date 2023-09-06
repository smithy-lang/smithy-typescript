package software.amazon.smithy.typescript.codegen;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class CodegenUtilsTest {
    @Test
    public void detectsJsonMediaTypes() {
        Assertions.assertTrue(CodegenUtils.isJsonMediaType("application/json"));
        Assertions.assertTrue(CodegenUtils.isJsonMediaType("custom+json"));
        Assertions.assertFalse(CodegenUtils.isJsonMediaType("application/xml"));
    }
}
