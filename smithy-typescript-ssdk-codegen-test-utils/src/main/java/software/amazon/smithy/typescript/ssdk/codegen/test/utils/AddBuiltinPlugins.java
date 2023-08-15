package software.amazon.smithy.typescript.ssdk.codegen.test.utils;

import static software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin.Convention.HAS_CONFIG;
import static software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin.Convention.HAS_MIDDLEWARE;

import java.util.List;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.utils.ListUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Adds built-in plugins.
 */
@SmithyInternalApi
public class AddBuiltinPlugins implements TypeScriptIntegration {

    @Override
    public List<RuntimeClientPlugin> getClientPlugins() {
        // Note that order is significant because configurations might
        // rely on previously resolved values.
        return ListUtils.of(
            RuntimeClientPlugin.builder()
                .withConventions(
                    TypeScriptDependency.CONFIG_RESOLVER.dependency, "CustomEndpoints", HAS_CONFIG)
                .build(),
            RuntimeClientPlugin.builder()
                .withConventions(TypeScriptDependency.MIDDLEWARE_RETRY.dependency, "Retry")
                .build(),
            RuntimeClientPlugin.builder()
                .withConventions(TypeScriptDependency.MIDDLEWARE_CONTENT_LENGTH.dependency, "ContentLength",
                    HAS_MIDDLEWARE)
                .build());
    }
}
 