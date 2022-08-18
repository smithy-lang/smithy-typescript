package software.amazon.smithy.typescript.codegen;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;

import java.util.HashMap;
import java.util.stream.Stream;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PackageJsonGeneratorTest {
    @ParameterizedTest
    @MethodSource("providePackageDescriptionTestCases")
    void expectPackageDescriptionUpdatedByArtifactType(TypeScriptSettings.ArtifactType artifactType, String expectedDescription) {
        Model model = Model.assembler()
                .addImport(getClass().getResource("simple-service.smithy"))
                .assemble()
                .unwrap();

        MockManifest manifest = new MockManifest();

        ObjectNode settings = Node.objectNodeBuilder()
                .withMember("service", Node.from("smithy.example#Example"))
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build();

        final TypeScriptSettings typeScriptSettings = TypeScriptSettings.from(model, settings, artifactType);

        PackageJsonGenerator.writePackageJson(typeScriptSettings, manifest, new HashMap<>());

        assertTrue(manifest.getFileString(PackageJsonGenerator.PACKAGE_JSON_FILENAME).isPresent());

        String packageJson = manifest.getFileString(PackageJsonGenerator.PACKAGE_JSON_FILENAME).get();

        assertThat(packageJson, containsString(String.format("\"description\": \"%s\"", expectedDescription)));
    }

    private static Stream<Arguments> providePackageDescriptionTestCases() {
        return Stream.of(
            Arguments.of(TypeScriptSettings.ArtifactType.SSDK, "example server"),
            Arguments.of(TypeScriptSettings.ArtifactType.CLIENT, "example client")
        );
    }
}
