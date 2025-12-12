/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;

public class RuntimeConfigGeneratorTest {

    @Test
    public void expandsRuntimeConfigFile() {
        Model model = Model.assembler().addImport(getClass().getResource("simple-service.smithy")).assemble().unwrap();
        MockManifest manifest = new MockManifest();

        List<TypeScriptIntegration> integrations = new ArrayList<>();
        integrations.add(
            new TypeScriptIntegration() {
                @Override
                public Map<String, Consumer<TypeScriptWriter>> getRuntimeConfigWriters(
                    TypeScriptSettings settings,
                    Model model,
                    SymbolProvider symbolProvider,
                    LanguageTarget target
                ) {
                    Map<String, Consumer<TypeScriptWriter>> config = new HashMap<>();
                    config.put("syn", writer -> {
                        writer.write("syn: 'ack1',");
                    });
                    config.put("foo", writer -> {
                        writer.write("foo: 'bar',");
                    });
                    return config;
                }
            }
        );

        integrations.add(
            new TypeScriptIntegration() {
                @Override
                public Map<String, Consumer<TypeScriptWriter>> getRuntimeConfigWriters(
                    TypeScriptSettings settings,
                    Model model,
                    SymbolProvider symbolProvider,
                    LanguageTarget target
                ) {
                    Map<String, Consumer<TypeScriptWriter>> config = new HashMap<>();
                    config.put("syn", writer -> {
                        writer.write("syn: 'ack2',");
                    });
                    return config;
                }
            }
        );

        TypeScriptSettings settings = TypeScriptSettings.from(
            model,
            Node.objectNodeBuilder()
                .withMember("service", Node.from("smithy.example#Example"))
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build()
        );
        SymbolProvider symbolProvider = new SymbolVisitor(model, settings);
        TypeScriptDelegator delegator = new TypeScriptDelegator(manifest, symbolProvider);
        RuntimeConfigGenerator generator = new RuntimeConfigGenerator(
            settings,
            model,
            symbolProvider,
            delegator,
            integrations,
            ApplicationProtocol.createDefaultHttpApplicationProtocol()
        );
        generator.generate(LanguageTarget.NODE);
        generator.generate(LanguageTarget.BROWSER);
        generator.generate(LanguageTarget.REACT_NATIVE);
        generator.generate(LanguageTarget.SHARED);
        delegator.flushWriters();

        Assertions.assertTrue(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/runtimeConfig.ts"));
        Assertions.assertTrue(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/runtimeConfig.browser.ts"));
        Assertions.assertTrue(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/runtimeConfig.native.ts"));
        Assertions.assertTrue(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/runtimeConfig.shared.ts"));

        // Does the runtimeConfig.shared.ts file expand the template properties properly?
        String runtimeConfigSharedContents = manifest
            .getFileString(CodegenUtils.SOURCE_FOLDER + "/runtimeConfig.shared.ts")
            .get();
        assertThat(
            runtimeConfigSharedContents,
            containsString("export const getRuntimeConfig = (config: ExampleClientConfig) =>")
        );
        assertThat(runtimeConfigSharedContents, containsString("apiVersion: \"1.0.0\","));
        assertThat(runtimeConfigSharedContents, containsString("config?.syn ?? syn: 'ack2',"));
        assertThat(runtimeConfigSharedContents, containsString("config?.foo ?? foo: 'bar',"));

        // Does the runtimeConfig.ts file expand the template properties properly?
        String runtimeConfigContents = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/runtimeConfig.ts").get();
        assertThat(
            runtimeConfigContents,
            containsString("import type { ExampleClientConfig } from \"./ExampleClient\";")
        );
        assertThat(
            runtimeConfigSharedContents,
            containsString("export const getRuntimeConfig = (config: ExampleClientConfig) =>")
        );
        assertThat(runtimeConfigContents, containsString("config?.syn ?? syn: 'ack2',"));
        assertThat(runtimeConfigSharedContents, containsString("config?.foo ?? foo: 'bar',"));

        // Does the runtimeConfig.browser.ts file expand the template properties properly?
        String runtimeConfigBrowserContents = manifest
            .getFileString(CodegenUtils.SOURCE_FOLDER + "/runtimeConfig.browser.ts")
            .get();
        assertThat(
            runtimeConfigBrowserContents,
            containsString("import type { ExampleClientConfig } from \"./ExampleClient\";")
        );
        assertThat(
            runtimeConfigSharedContents,
            containsString("export const getRuntimeConfig = (config: ExampleClientConfig) =>")
        );
        assertThat(runtimeConfigContents, containsString("config?.syn ?? syn: 'ack2',"));
        assertThat(runtimeConfigSharedContents, containsString("config?.foo ?? foo: 'bar',"));

        // Does the runtimeConfig.native.ts file expand the browser template properties properly?
        String runtimeConfigNativeContents = manifest
            .getFileString(CodegenUtils.SOURCE_FOLDER + "/runtimeConfig.native.ts")
            .get();
        assertThat(
            runtimeConfigNativeContents,
            containsString("import type { ExampleClientConfig } from \"./ExampleClient\";")
        );
        assertThat(
            runtimeConfigNativeContents,
            containsString(
                "import { getRuntimeConfig as getBrowserRuntimeConfig } from \"./runtimeConfig.browser\";"
            )
        );
        assertThat(
            runtimeConfigSharedContents,
            containsString("export const getRuntimeConfig = (config: ExampleClientConfig) =>")
        );
        assertThat(runtimeConfigContents, containsString("config?.syn ?? syn: 'ack2',"));
        assertThat(runtimeConfigSharedContents, containsString("config?.foo ?? foo: 'bar',"));
    }
}
