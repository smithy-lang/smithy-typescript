/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
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

    private PackageJsonGenerator() {}

    static void writePackageJson(
            TypeScriptSettings settings,
            FileManifest manifest,
            Map<String, Map<String, SymbolDependency>> dependencies
    ) {
        // Write the package.json file.
        InputStream resource = PackageJsonGenerator.class.getResourceAsStream("base-package.json");
        ObjectNode node = Node.parse(IoUtils.toUtf8String(resource))
                        .expectObjectNode()
                        .merge(settings.getPackageJson());

        // Merge TypeScript dependencies into the package.json file.
        for (Map.Entry<String, Map<String, SymbolDependency>> depEntry : dependencies.entrySet()) {
            ObjectNode currentValue = node.getObjectMember(depEntry.getKey()).orElse(Node.objectNode());
            ObjectNode.Builder builder = currentValue.toBuilder();
            for (Map.Entry<String, SymbolDependency> entry : depEntry.getValue().entrySet()) {
                builder.withMember(entry.getKey(), entry.getValue().getVersion());
            }
            node = node.withMember(depEntry.getKey(), builder.build());
        }

        // These are currently only generated for clients, but they may be needed for ssdk as well.
        if (settings.generateClient()) {
            // Add the Node vs Browser hook.
            node = node.withMember("browser", Node.objectNode()
                    .withMember("./dist-es/runtimeConfig", "./dist-es/runtimeConfig.browser"));
            // Add the ReactNative hook.
            node = node.withMember("react-native", Node.objectNode()
                    .withMember("./dist-es/runtimeConfig", "./dist-es/runtimeConfig.native"));
        }

        // Set the package to private if required.
        if (settings.isPrivate()) {
            node = node.withMember("private", true);
        }

        // Expand template parameters.
        String template = Node.prettyPrintJson(node);
        template = template.replace("${package}", settings.getPackageName());
        template = template.replace("${packageDescription}", settings.getPackageDescription());
        template = template.replace("${packageVersion}", settings.getPackageVersion());
        template = template.replace("${packageManager}", settings.getPackageManager().getCommand());
        manifest.writeFile("package.json", template);
    }
}
