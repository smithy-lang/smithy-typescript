package software.amazon.smithy.typescript.codegen;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.shapes.ShapeId;

import java.util.stream.Stream;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.jupiter.api.Assertions.assertEquals;

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
    public void defaultsToYarn() {
        Model model = Model.assembler()
                .addImport(getClass().getResource("simple-service.smithy"))
                .assemble()
                .unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());

        assertEquals(TypeScriptSettings.PackageManager.YARN, settings.getPackageManager());
    }

    @Test
    public void canBeConfiguredToNpm() {
        Model model = Model.assembler()
                .addImport(getClass().getResource("simple-service.smithy"))
                .assemble()
                .unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .withMember("packageManager", Node.from("npm"))
                .build());

        assertEquals(TypeScriptSettings.PackageManager.NPM, settings.getPackageManager());
    }


    @ParameterizedTest
    @MethodSource("providePackageDescriptionTestCases")
    void expectPackageDescriptionUpdatedByArtifactType(TypeScriptSettings.ArtifactType artifactType, String expectedDescription) {
        Model model = Model.assembler()
                .addImport(getClass().getResource("simple-service.smithy"))
                .assemble()
                .unwrap();

        ObjectNode settings = Node.objectNodeBuilder()
                .withMember("service", Node.from("smithy.example#Example"))
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build();

        final TypeScriptSettings typeScriptSettings = TypeScriptSettings.from(model, settings, artifactType);

        assertEquals(typeScriptSettings.getPackageDescription(), expectedDescription);
    }

    private static Stream<Arguments> providePackageDescriptionTestCases() {
        return Stream.of(
                Arguments.of(TypeScriptSettings.ArtifactType.SSDK, "example server"),
                Arguments.of(TypeScriptSettings.ArtifactType.CLIENT, "example client")
        );
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
