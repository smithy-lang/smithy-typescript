package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;

class PackageJsonGeneratorTest {
  @ParameterizedTest
  @MethodSource("providePackageDescriptionTestCases")
  void expectPackageDescriptionUpdatedByArtifactType(
      TypeScriptSettings.ArtifactType artifactType, String expectedDescription) {
    Model model =
        Model.assembler()
            .addImport(getClass().getResource("simple-service.smithy"))
            .assemble()
            .unwrap();

    MockManifest manifest = new MockManifest();

    ObjectNode settings =
        Node.objectNodeBuilder()
            .withMember("service", Node.from("smithy.example#Example"))
            .withMember("package", Node.from("example"))
            .withMember("packageVersion", Node.from("1.0.0"))
            .build();

    final TypeScriptSettings typeScriptSettings =
        TypeScriptSettings.from(model, settings, artifactType);

    PackageJsonGenerator.writePackageJson(typeScriptSettings, manifest, new HashMap<>());

    assertTrue(manifest.getFileString(PackageJsonGenerator.PACKAGE_JSON_FILENAME).isPresent());

    String packageJson = manifest.getFileString(PackageJsonGenerator.PACKAGE_JSON_FILENAME).get();

    assertThat(
        packageJson, containsString(String.format("\"description\": \"%s\"", expectedDescription)));
  }

  @Test
  void expectPackageBrowserFieldToBeMerged() {
    Model model =
        Model.assembler()
            .addImport(getClass().getResource("simple-service.smithy"))
            .assemble()
            .unwrap();

    MockManifest manifest = new MockManifest();

    ObjectNode settings =
        Node.objectNodeBuilder()
            .withMember("service", Node.from("smithy.example#Example"))
            .withMember("package", Node.from("example"))
            .withMember("packageVersion", Node.from("1.0.0"))
            .withMember("packageDescription", Node.from("example description"))
            .build();

    final TypeScriptSettings typeScriptSettings =
        TypeScriptSettings.from(model, settings, TypeScriptSettings.ArtifactType.CLIENT);

    var pjson = typeScriptSettings.getPackageJson();
    pjson =
        pjson.withMember(
            "browser", Node.objectNode().withMember("example-browser", Node.from("example")));
    pjson =
        pjson.withMember(
            "react-native",
            Node.objectNode().withMember("example-react-native", Node.from("example")));
    typeScriptSettings.setPackageJson(pjson);

    PackageJsonGenerator.writePackageJson(typeScriptSettings, manifest, new HashMap<>());

    assertTrue(manifest.getFileString(PackageJsonGenerator.PACKAGE_JSON_FILENAME).isPresent());

    String packageJson = manifest.getFileString(PackageJsonGenerator.PACKAGE_JSON_FILENAME).get();
    ObjectNode packageJsonNode = Node.parse(packageJson).expectObjectNode();

    Node expectedBrowserNode =
        Node.parse(
            """
            {
                "example-browser": "example",
                "./dist-es/runtimeConfig": "./dist-es/runtimeConfig.browser"
            }
            """);
    Node expectedReactNativeNode =
        Node.parse(
            """
            {
                  "example-react-native": "example",
                  "./dist-es/runtimeConfig": "./dist-es/runtimeConfig.native"
            }
            """);

    Node.assertEquals(packageJsonNode.expectObjectMember("browser"), expectedBrowserNode);
    Node.assertEquals(packageJsonNode.expectObjectMember("react-native"), expectedReactNativeNode);
  }

  @Test
  void expectTestScriptAndTestConfigToBeAdded() {
    Model model =
        Model.assembler()
            .addImport(getClass().getResource("simple-service.smithy"))
            .assemble()
            .unwrap();

    MockManifest manifest = new MockManifest();

    ObjectNode settings =
        Node.objectNodeBuilder()
            .withMember("service", Node.from("smithy.example#Example"))
            .withMember("package", Node.from("example"))
            .withMember("packageVersion", Node.from("1.0.0"))
            .withMember("packageDescription", Node.from("example description"))
            .build();

    final TypeScriptSettings typeScriptSettings =
        TypeScriptSettings.from(model, settings, TypeScriptSettings.ArtifactType.CLIENT);

    Map<String, Map<String, SymbolDependency>> deps = new HashMap<>();
    Map<String, SymbolDependency> devDeps = new HashMap<>();

    devDeps.put("vitest", TypeScriptDependency.VITEST.dependency);
    deps.put("devDependencies", devDeps);

    PackageJsonGenerator.writePackageJson(typeScriptSettings, manifest, deps);

    assertTrue(manifest.getFileString(PackageJsonGenerator.PACKAGE_JSON_FILENAME).isPresent());
    assertTrue(manifest.getFileString(PackageJsonGenerator.VITEST_CONFIG_FILENAME).isPresent());

    String packageJson = manifest.getFileString(PackageJsonGenerator.PACKAGE_JSON_FILENAME).get();
    String configString = manifest.getFileString(PackageJsonGenerator.VITEST_CONFIG_FILENAME).get();

    assertThat(packageJson, containsString("\"test\": \"yarn g:vitest run --passWithNoTests\""));
    assertThat(configString, containsString("include: [\"**/*.spec.ts\"]"));
  }

  @Test
  void expectTypeDocToNotBeAdded() {
    Model model =
        Model.assembler()
            .addImport(getClass().getResource("simple-service.smithy"))
            .assemble()
            .unwrap();

    MockManifest manifest = new MockManifest();

    ObjectNode settings =
        Node.objectNodeBuilder()
            .withMember("service", Node.from("smithy.example#Example"))
            .withMember("package", Node.from("example"))
            .withMember("packageVersion", Node.from("1.0.0"))
            .withMember("packageDescription", Node.from("example description"))
            .build();

    final TypeScriptSettings typeScriptSettings =
        TypeScriptSettings.from(model, settings, TypeScriptSettings.ArtifactType.CLIENT);

    Map<String, Map<String, SymbolDependency>> deps = new HashMap<>();

    PackageJsonGenerator.writePackageJson(typeScriptSettings, manifest, deps);

    assertTrue(manifest.getFileString(PackageJsonGenerator.PACKAGE_JSON_FILENAME).isPresent());
    assertTrue(manifest.getFileString(PackageJsonGenerator.TYPEDOC_FILE_NAME).isEmpty());

    String packageJson = manifest.getFileString(PackageJsonGenerator.PACKAGE_JSON_FILENAME).get();

    assertThat(packageJson, not(containsString("\"build:docs\": \"typedoc\"")));
    assertThat(packageJson, not(containsString("\"typedoc\": \"0.23.23\"")));
  }

  @Test
  void expectTypeDocToBeAddedWithGenerateTypeDoc() {
    Model model =
        Model.assembler()
            .addImport(getClass().getResource("simple-service.smithy"))
            .assemble()
            .unwrap();

    MockManifest manifest = new MockManifest();

    ObjectNode settings =
        Node.objectNodeBuilder()
            .withMember("service", Node.from("smithy.example#Example"))
            .withMember("package", Node.from("example"))
            .withMember("packageVersion", Node.from("1.0.0"))
            .withMember("packageDescription", Node.from("example description"))
            .withMember("generateTypeDoc", true)
            .build();

    final TypeScriptSettings typeScriptSettings =
        TypeScriptSettings.from(model, settings, TypeScriptSettings.ArtifactType.CLIENT);

    Map<String, Map<String, SymbolDependency>> deps = new HashMap<>();

    PackageJsonGenerator.writePackageJson(typeScriptSettings, manifest, deps);

    assertTrue(manifest.getFileString(PackageJsonGenerator.PACKAGE_JSON_FILENAME).isPresent());
    assertTrue(manifest.getFileString(PackageJsonGenerator.TYPEDOC_FILE_NAME).isPresent());

    String packageJson = manifest.getFileString(PackageJsonGenerator.PACKAGE_JSON_FILENAME).get();

    assertThat(packageJson, containsString("\"build:docs\": \"typedoc\""));
    assertThat(packageJson, containsString("\"typedoc\": \"0.23.23\""));
  }

  private static Stream<Arguments> providePackageDescriptionTestCases() {
    return Stream.of(
        Arguments.of(TypeScriptSettings.ArtifactType.SSDK, "example server"),
        Arguments.of(TypeScriptSettings.ArtifactType.CLIENT, "example client"));
  }
}
