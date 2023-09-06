package software.amazon.smithy.typescript.codegen;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class ApplicationProtocolTest {
    @Test
    public void detectsHttpProtocols() {
        Assertions.assertTrue(ApplicationProtocol.createDefaultHttpApplicationProtocol().isHttpProtocol());
    }

    @Test
    public void detectsMqttProtocols() {
        Assertions.assertFalse(ApplicationProtocol.createDefaultHttpApplicationProtocol().isMqttProtocol());
    }
}
