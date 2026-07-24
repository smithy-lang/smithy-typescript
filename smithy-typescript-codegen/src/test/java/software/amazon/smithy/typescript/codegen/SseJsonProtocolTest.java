/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;

public class SseJsonProtocolTest {

    private MockManifest generateServer(boolean experimentalSseProtocol) {
        Model model = Model.assembler(getClass().getClassLoader())
            .discoverModels(getClass().getClassLoader())
            .addImport(getClass().getResource("sse-json-event-stream.smithy"))
            .assemble()
            .unwrap();
        MockManifest manifest = new MockManifest();
        PluginContext context = PluginContext.builder()
            .model(model)
            .fileManifest(manifest)
            .pluginClassLoader(getClass().getClassLoader())
            .settings(
                Node.objectNodeBuilder()
                    .withMember("service", Node.from("smithy.example#Example"))
                    .withMember("package", Node.from("example-ssdk"))
                    .withMember("packageVersion", Node.from("1.0.0"))
                    .withMember("disableDefaultValidation", Node.from(true))
                    .withMember("experimentalSseProtocol", Node.from(experimentalSseProtocol))
                    .build()
            )
            .build();
        new TypeScriptServerCodegenPlugin().execute(context);
        return manifest;
    }

    private MockManifest generateServer() {
        return generateServer(true);
    }

    @Test
    public void wiresSseEventStreamProviderIntoHandler() {
        String handler = generateServer()
            .getFileString(CodegenUtils.SOURCE_FOLDER + "/server/operations/Publish.ts")
            .get();
        assertThat(handler, containsString("sseEventStreamSerdeProvider"));
        assertThat(handler, containsString("eventStreamMarshaller: sseEventStreamSerdeProvider("));
    }

    @Test
    public void generatesEventStreamSerdeForTheStreamUnion() {
        String protocol = generateServer()
            .getFileString(CodegenUtils.SOURCE_FOLDER + "/protocols/Ssejson.ts")
            .get();
        assertThat(protocol, containsString("se_PublishEvents"));
        assertThat(protocol, containsString("de_PublishEvents"));
        assertThat(protocol, containsString("eventStreamMarshaller"));
    }

    @Test
    public void protocolIsInertWithoutTheExperimentalFlag() {
        assertThat(
            generateServer(false).hasFile(CodegenUtils.SOURCE_FOLDER + "/protocols/Ssejson.ts"),
            is(false)
        );
    }
}
