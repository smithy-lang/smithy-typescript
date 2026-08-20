/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;

public class ServiceAggregatedClientGeneratorTest {

    @Test
    public void operationMethodsAcceptRequestOptionsWithRecorder() {
        MockManifest manifest = new MockManifest();
        PluginContext context = PluginContext.builder()
            .pluginClassLoader(getClass().getClassLoader())
            .model(
                Model.assembler()
                    .addImport(getClass().getResource("output-structure.smithy"))
                    .discoverModels()
                    .assemble()
                    .unwrap()
            )
            .fileManifest(manifest)
            .settings(
                Node.objectNodeBuilder()
                    .withMember("service", Node.from("smithy.example#Example"))
                    .withMember("package", Node.from("example"))
                    .withMember("packageVersion", Node.from("1.0.0"))
                    .build()
            )
            .build();

        new TypeScriptCodegenPlugin().execute(context);
        String contents = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "//Example.ts").get();

        // A named, readable options type is generated (superset of the transport options).
        assertThat(contents, containsString("export interface ExampleRequestOptions extends __HttpHandlerOptions"));
        assertThat(contents, containsString("recorder?: __MetricsRecorder<any>;"));
        // Convenience methods reference the named type rather than an inline composed type.
        assertThat(contents, containsString("options?: ExampleRequestOptions"));
        assertThat(contents, containsString("options: ExampleRequestOptions"));
    }
}
