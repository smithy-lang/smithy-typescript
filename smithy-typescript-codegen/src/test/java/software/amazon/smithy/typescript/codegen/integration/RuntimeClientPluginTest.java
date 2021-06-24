package software.amazon.smithy.typescript.codegen.integration;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.utils.ListUtils;

public class RuntimeClientPluginTest {
    @Test
    public void allowsAllServicesByDefault() {
        ServiceShape service = ServiceShape.builder().id("a.b#C").version("123").build();
        OperationShape operation = OperationShape.builder().id("a.b#Operation").build();
        Model model = Model.assembler()
                .addShapes(service, operation)
                .assemble()
                .unwrap();
        RuntimeClientPlugin plugin = RuntimeClientPlugin.builder()
                .servicePredicate((m, s) -> s.getId().getName().equals("C"))
                .build();

        assertThat(plugin.matchesService(model, service), equalTo(true));
        assertThat(plugin.matchesOperation(model, service, operation), equalTo(false));
    }

    @Test
    public void allowsConfigurableOperationsPredicate() {
        ServiceShape service = ServiceShape.builder().id("a.b#C").version("123").build();
        OperationShape operation1 = OperationShape.builder().id("a.b#D").build();
        OperationShape operation2 = OperationShape.builder().id("a.b#E").build();
        Model model = Model.assembler()
                .addShapes(service, operation1, operation2)
                .assemble()
                .unwrap();
        RuntimeClientPlugin plugin = RuntimeClientPlugin.builder()
                .operationPredicate((m, s, o) -> o.getId().getName().equals("D"))
                .build();

        assertThat(plugin.matchesOperation(model, service, operation1), equalTo(true));
        assertThat(plugin.matchesOperation(model, service, operation2), equalTo(false));
        assertThat(plugin.matchesService(model, service), equalTo(false));
    }

    @Test
    public void allowsConfigurableServicePredicate() {
        ServiceShape service1 = ServiceShape.builder().id("a.b#C").version("123").build();
        ServiceShape service2 = ServiceShape.builder().id("a.b#D").version("123").build();
        OperationShape operation = OperationShape.builder().id("a.b#Operation").build();
        Model model = Model.assembler()
                .addShapes(service1, service2, operation)
                .assemble()
                .unwrap();
        RuntimeClientPlugin plugin = RuntimeClientPlugin.builder()
                .servicePredicate((m, s) -> s.getId().getName().equals("C"))
                .build();

        assertThat(plugin.matchesService(model, service1), equalTo(true));
        assertThat(plugin.matchesService(model, service2), equalTo(false));
        assertThat(plugin.matchesOperation(model, service1, operation), equalTo(false));
        assertThat(plugin.matchesOperation(model, service2, operation), equalTo(false));
    }

    @Test
    public void configuresWithDefaultConventions() {
        Map<String, Object> resolveFunctionParams = new HashMap<String, Object>() {{
                put("resolveFunctionParam", "resolveFunctionParam");
        }};
        Map<String, Object> pluginFunctionParams = new HashMap<String, Object>() {{
                put("pluginFunctionParam", "pluginFunctionParam");
        }};

        RuntimeClientPlugin plugin = RuntimeClientPlugin.builder()
                .withConventions("foo/baz", "1.0.0", "Foo")
                .additionalResolveFunctionParamsSupplier((m, s, o) -> resolveFunctionParams)
                .additionalPluginFunctionParamsSupplier((m, s, o) -> pluginFunctionParams)
                .build();

        assertThat(plugin.getInputConfig().get().getSymbol().getNamespace(), equalTo("foo/baz"));
        assertThat(plugin.getInputConfig().get().getSymbol().getName(), equalTo("FooInputConfig"));

        assertThat(plugin.getResolvedConfig().get().getSymbol().getNamespace(), equalTo("foo/baz"));
        assertThat(plugin.getResolvedConfig().get().getSymbol().getName(), equalTo("FooResolvedConfig"));

        assertThat(plugin.getResolveFunction().get().getSymbol().getNamespace(), equalTo("foo/baz"));
        assertThat(plugin.getResolveFunction().get().getSymbol().getName(), equalTo("resolveFooConfig"));

        assertThat(plugin.getAdditionalResolveFunctionParameters(null, null, null),
                equalTo(resolveFunctionParams));

        assertThat(plugin.getPluginFunction().get().getSymbol().getNamespace(), equalTo("foo/baz"));
        assertThat(plugin.getPluginFunction().get().getSymbol().getName(), equalTo("getFooPlugin"));

        assertThat(plugin.getAdditionalPluginFunctionParameters(null, null, null),
                equalTo(pluginFunctionParams));

        assertThat(plugin.getInputConfig().get().getSymbol().getDependencies().get(0).getPackageName(),
                   equalTo("foo/baz"));
        assertThat(plugin.getResolvedConfig().get().getSymbol().getDependencies().get(0).getPackageName(),
                   equalTo("foo/baz"));
        assertThat(plugin.getResolveFunction().get().getSymbol().getDependencies().get(0).getPackageName(),
                   equalTo("foo/baz"));
        assertThat(plugin.getPluginFunction().get().getSymbol().getDependencies().get(0).getPackageName(),
                   equalTo("foo/baz"));

        assertThat(plugin.getInputConfig().get().getSymbol().getDependencies().get(0).getVersion(),
                   equalTo("1.0.0"));
        assertThat(plugin.getResolvedConfig().get().getSymbol().getDependencies().get(0).getVersion(),
                   equalTo("1.0.0"));
        assertThat(plugin.getResolveFunction().get().getSymbol().getDependencies().get(0).getVersion(),
                   equalTo("1.0.0"));
        assertThat(plugin.getPluginFunction().get().getSymbol().getDependencies().get(0).getVersion(),
                   equalTo("1.0.0"));
    }

    @Test
    public void allConfigSymbolsMustBeSetIfAnyAreSet() {
        Assertions.assertThrows(IllegalStateException.class, () -> RuntimeClientPlugin.builder()
                .inputConfig(Symbol.builder().namespace("foo", "/").name("abc").build()).build());
    }

    @Test
    public void destroyFunctionRequiresResolvedConfig() {
        Assertions.assertThrows(IllegalStateException.class, () -> RuntimeClientPlugin.builder()
                .withConventions("foo/baz", "1.0.0", "Foo", RuntimeClientPlugin.Convention.HAS_DESTROY)
                .build());
    }

    @Test
    public void convertsToBuilder() {
        RuntimeClientPlugin plugin = RuntimeClientPlugin.builder()
                .withConventions("foo/baz", "1.0.0", "Foo")
                .build();

        assertThat(plugin.toBuilder().build(), equalTo(plugin));
    }
}
