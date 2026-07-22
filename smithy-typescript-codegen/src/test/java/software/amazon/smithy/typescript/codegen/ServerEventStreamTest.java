/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;

public class ServerEventStreamTest {

    private MockManifest generateServer() {
        Model model = Model.assembler(getClass().getClassLoader())
            .discoverModels(getClass().getClassLoader())
            .addImport(getClass().getResource("server-event-stream.smithy"))
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
                    .build()
            )
            .build();
        new TypeScriptServerCodegenPlugin().execute(context);
        return manifest;
    }

    @Test
    public void wiresEventStreamMarshallerIntoServerSerdeContext() {
        MockManifest manifest = generateServer();
        String handler = manifest.getFileString(
            CodegenUtils.SOURCE_FOLDER + "/server/operations/Publish.ts"
        ).get();
        // The server handler's serde context base must supply an event stream marshaller,
        // reusing the Node event stream serde provider (which only needs utf8 encode/decode).
        assertThat(handler, containsString("eventStreamSerdeProvider"));
        assertThat(handler, containsString("eventStreamMarshaller: eventStreamSerdeProvider("));
    }

    @Test
    public void generatesEventStreamSerdeWithTypedContext() {
        MockManifest manifest = generateServer();
        String protocol = manifest.getFileString(
            CodegenUtils.SOURCE_FOLDER + "/protocols/Rpcv2cbor.ts"
        ).get();
        // Event stream serde functions are generated and use the strongly typed
        // __EventStreamSerdeContext rather than an untyped `any` escape hatch.
        assertThat(protocol, containsString("__EventStreamSerdeContext"));
        assertThat(protocol, not(containsString("unsupported in ssdk")));
    }
}
