package software.amazon.smithy.typescript.codegen;

import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;

/**
 * This SymbolProvider is used to test that CodegenVisitor actually decorates
 * the provided SymbolProvider using integrations found on the classpath. It is
 * enabled by setting "__customServiceName" in the provided settings object.
 */
public final class SymbolDecoratorIntegration implements TypeScriptIntegration {
    @Override
    public SymbolProvider decorateSymbolProvider(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider
    ) {
        String name = settings.getPluginSettings().getStringMemberOrDefault("__customServiceName", null);

        if (name == null) {
            return symbolProvider;
        }

        return shape -> {
            Symbol symbol = symbolProvider.toSymbol(shape);
            if (shape.isServiceShape()) {
                return symbol.toBuilder().name(name).definitionFile(name + ".ts").build();
            }

            return symbol;
        };
    }
}
