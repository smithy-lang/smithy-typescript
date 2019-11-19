package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.shapes.ShapeId;

public class TypeScriptSettingsTest {

    @Test
    public void resolvesDefaultService() {
        Model model = Model.assembler()
                .addImport(getClass().getResource("simple-service.smithy"))
                .assemble()
                .unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());

        assertThat(settings.getService(), equalTo(ShapeId.from("smithy.example#Example")));
    }

    @Test
    public void resolvesSupportProtocols() {
        // TODO
    }

    @Test
    public void defaultsApplicationProtocolToHttp() {
        // TODO
    }

    @Test
    public void throwsWhenProtocolsAreNotCoherent() {
        // TODO
    }
}
