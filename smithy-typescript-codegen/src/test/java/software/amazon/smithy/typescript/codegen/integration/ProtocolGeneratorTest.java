package software.amazon.smithy.typescript.codegen.integration;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

import org.junit.jupiter.api.Test;

public class ProtocolGeneratorTest {
    @Test
    public void sanitizesNames() {
        assertThat(ProtocolGenerator.getSanitizedName("aws.rest-json.1.1"), equalTo("Aws_restJson_1_1"));
    }

    @Test
    public void detectsCompatibleGenerators() {
        // TODO
    }

    @Test
    public void detectsIncompatibleGenerators() {
        // TODO
    }
}
