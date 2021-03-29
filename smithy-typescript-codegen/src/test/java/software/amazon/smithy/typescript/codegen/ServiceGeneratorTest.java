package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;

public class ServiceGeneratorTest {
    @Test
    public void hasHooksForService() {
        // TODO
    }

    @Test
    public void addsCustomIntegrationDependencyFields() {
        Model model = Model.assembler().addImport(getClass().getResource("simple-service.smithy")).assemble().unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("service", Node.from("smithy.example#Example"))
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());
        TypeScriptWriter writer = new TypeScriptWriter("./foo");
        SymbolProvider symbolProvider = TypeScriptCodegenPlugin.createSymbolProvider(model, settings);
        ApplicationProtocol applicationProtocol = ApplicationProtocol.createDefaultHttpApplicationProtocol();

        List<TypeScriptIntegration> integrations = new ArrayList<>();
        integrations.add(new TypeScriptIntegration() {
            @Override
            public void addConfigInterfaceFields(
                    TypeScriptSettings settings,
                    Model model,
                    SymbolProvider symbolProvider,
                    TypeScriptWriter writer
            ) {
                writer.writeDocs("Hello!");
                writer.write("syn?: string;");
            }
        });

        new ServiceGenerator(settings, model, symbolProvider, writer, integrations,
                             Collections.emptyList(), applicationProtocol).run();

        assertThat(writer.toString(), containsString("  /**\n"
                                                     + "   * Hello!\n"
                                                     + "   */\n"
                                                     + "  syn?: string;"));
    }
}
