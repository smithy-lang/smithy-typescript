/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import java.io.InputStream;
import java.util.Map;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.utils.IoUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Private class used to generates a package.json file for the project.
 */
@SmithyInternalApi
final class PackageJsonGenerator {

    public static final String PACKAGE_JSON_FILENAME = "package.json";
    public static final String TYPEDOC_FILE_NAME = "typedoc.json";
    public static final String VITEST_CONFIG_FILENAME = "vitest.config.mts";

    private PackageJsonGenerator() {}

    static void writePackageJson(
        TypeScriptSettings settings,
        FileManifest manifest,
        Map<String, Map<String, SymbolDependency>> dependencies
    ) {
        // Write the package.json file.
        InputStream resource = PackageJsonGenerator.class.getResourceAsStream("base-package.json");

        ObjectNode userSuppliedPackageJson = settings.getPackageJson();
        ObjectNode defaultPackageJson = Node.parse(IoUtils.toUtf8String(resource)).expectObjectNode();

        ObjectNode mergedScripts = defaultPackageJson
            .expectObjectMember("scripts")
            .merge(userSuppliedPackageJson.getObjectMember("scripts").orElse(ObjectNode.builder().build()));

        ObjectNode node = defaultPackageJson.merge(userSuppliedPackageJson).withMember("scripts", mergedScripts);

        // Merge TypeScript dependencies into the package.json file.
        for (Map.Entry<String, Map<String, SymbolDependency>> depEntry : dependencies.entrySet()) {
            ObjectNode currentValue = node.getObjectMember(depEntry.getKey()).orElse(Node.objectNode());
            ObjectNode.Builder builder = currentValue.toBuilder();
            for (Map.Entry<String, SymbolDependency> entry : depEntry.getValue().entrySet()) {
                builder.withMember(entry.getKey(), entry.getValue().getVersion());
            }
            node = node.withMember(depEntry.getKey(), builder.build());
        }

        // Add test script and vitest.config.mts if specs and their devDependency on vitest has been generated.
        ObjectNode devDeps = node.getObjectMember("devDependencies").orElse(Node.objectNode());
        if (devDeps.containsMember(TypeScriptDependency.VITEST.packageName)) {
            ObjectNode scripts = node.getObjectMember("scripts").orElse(Node.objectNode());
            String pkgManagerExec = settings.getPackageManager().getCommand().replaceFirst("^npm$", "npx");
            scripts = scripts.withMember("test", "%s vitest run --passWithNoTests".formatted(pkgManagerExec));
            node = node.withMember("scripts", scripts);

            manifest.writeFile(
                VITEST_CONFIG_FILENAME,
                IoUtils.toUtf8String(PackageJsonGenerator.class.getResourceAsStream(VITEST_CONFIG_FILENAME))
            );
        }

        if (settings.generateTypeDoc()) {
            // Add typedoc to the "devDependencies" if not present
            if (devDeps.getMember(TypeScriptDependency.TYPEDOC.packageName).isEmpty()) {
                devDeps = devDeps.withMember(
                    TypeScriptDependency.TYPEDOC.packageName,
                    TypeScriptDependency.TYPEDOC.version
                );
                node = node.withMember("devDependencies", devDeps);
            }

            // Add @smithy/service-client-documentation-generator to the "devDependencies" if not present
            if (devDeps.getMember(TypeScriptDependency.AWS_SDK_CLIENT_DOCGEN.packageName).isEmpty()) {
                devDeps = devDeps.withMember(
                    TypeScriptDependency.AWS_SDK_CLIENT_DOCGEN.packageName,
                    TypeScriptDependency.AWS_SDK_CLIENT_DOCGEN.version
                );
                node = node.withMember("devDependencies", devDeps);
            }

            // Add build:docs script
            ObjectNode scripts = node.getObjectMember("scripts").orElse(Node.objectNode());
            scripts = scripts.withMember("build:docs", "typedoc");
            node = node.withMember("scripts", scripts);

            // Write typedoc.json
            manifest.writeFile(TYPEDOC_FILE_NAME, PackageJsonGenerator.class, TYPEDOC_FILE_NAME);
        }

        // These are currently only generated for clients, but they may be needed for ssdk as well.
        if (settings.generateClient()) {
            // Add the Node vs Browser hook.
            node = node.withMember(
                "browser",
                node
                    .getObjectMember("browser")
                    .orElse(Node.objectNode())
                    .withMember("./dist-es/runtimeConfig", "./dist-es/runtimeConfig.browser")
            );
            // Add the ReactNative hook.
            node = node.withMember(
                "react-native",
                node
                    .getObjectMember("react-native")
                    .orElse(Node.objectNode())
                    .withMember("./dist-es/runtimeConfig", "./dist-es/runtimeConfig.native")
            );
        }

        // Set the package to private if required.
        if (settings.isPrivate()) {
            node = node.withMember("private", true);
        }

        if (!settings.generateIndexTests()) {
            node = node.withMember("scripts", node.getObjectMember("scripts").get().withoutMember("test:index"));
        }

        // Expand template parameters.
        String template = Node.prettyPrintJson(node);
        template = template.replace("${package}", settings.getPackageName());
        template = template.replace("${packageDescription}", settings.getPackageDescription());
        template = template.replace("${packageVersion}", settings.getPackageVersion());
        template = template.replace("${packageManager}", settings.getPackageManager().getCommand());
        manifest.writeFile(PACKAGE_JSON_FILENAME, template);
    }
}
