package software.amazon.smithy.typescript.ssdk.codegen.test.utils;

import java.util.List;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.utils.ListUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Adds fake protocols.
 */
@SmithyInternalApi
public class AddProtocols implements TypeScriptIntegration {

    @Override
    public List<ProtocolGenerator> getProtocolGenerators() {
        return ListUtils.of(new TestProtocolGenerator());
    }
}
