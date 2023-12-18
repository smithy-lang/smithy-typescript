/*
 * Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

package software.amazon.smithy.typescript.codegen.integration;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.is;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.TypeScriptClientCodegenPlugin;

@Disabled("WIP")
public class AddHttpApiKeyAuthPluginTest {
    @Test
    public void httpApiKeyAuthClientOnService() {
        testInjects("http-api-key-auth-trait.smithy",
                ", { in: 'header', name: 'Authorization', scheme: 'ApiKey' }");
    }

    @Test
    public void httpApiKeyAuthClientOnOperation() {
        testInjects("http-api-key-auth-trait-on-operation.smithy",
                ", { in: 'header', name: 'Authorization', scheme: 'ApiKey' }");
    }

    // This should be identical to the httpApiKeyAuthClient test except for the parameters provided
    // to the middleware.
    @Test
    public void httpApiKeyAuthClientNoScheme() {
        testInjects("http-api-key-auth-trait-no-scheme.smithy", ", { in: 'header', name: 'Authorization' }");
    }

    private void testInjects(String filename, String extra) {
        MockManifest manifest = generate(filename);

        // Ensure that the client imports the config properly and calls the resolve function.
        assertThat(manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/ExampleClient.ts").get(),
                containsString("from \"./middleware/HttpApiKeyAuth\""));
        assertThat(manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/ExampleClient.ts").get(),
                containsString("= resolveHttpApiKeyAuthConfig("));

        // Ensure that the GetFoo operation imports the middleware and uses it with all the options.
        assertThat(manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/commands/GetFooCommand.ts").get(),
                containsString("from \"../middleware/HttpApiKeyAuth\""));
        assertThat(manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/commands/GetFooCommand.ts").get(),
                containsString("this.middlewareStack.use(getHttpApiKeyAuthPlugin(configuration" + extra + "));"));

        // Ensure that the GetBar operation does not import the middleware or use it.
        assertThat(manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/commands/GetBarCommand.ts").get(),
                not(containsString("from \"../middleware/HttpApiKeyAuth\"")));
        assertThat(manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/commands/GetBarCommand.ts").get(),
                not(containsString("this.middlewareStack.use(getHttpApiKeyAuthPlugin")));

        // Make sure that the middleware file was written and exports the plugin symbol.
        assertThat(manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/middleware/HttpApiKeyAuth/index.ts").get(),
                containsString("export const getHttpApiKeyAuthPlugin"));

        // Ensure that the middleware was being exported in the index file.
        assertThat(manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/index.ts").get(),
                containsString("from \"./middleware/HttpApiKeyAuth\""));
    }

    private MockManifest generate(String filename)
    {
        MockManifest manifest = new MockManifest();
        PluginContext context = PluginContext.builder()
                .pluginClassLoader(getClass().getClassLoader())
                .model(Model.assembler()
                        .addImport(getClass().getResource(filename))
                        .discoverModels()
                        .assemble()
                        .unwrap())
                .fileManifest(manifest)
                .settings(Node.objectNodeBuilder()
                        .withMember("service", Node.from("smithy.example#Example"))
                        .withMember("package", Node.from("example"))
                        .withMember("packageVersion", Node.from("1.0.0"))
                        .build())
                .build();

        new TypeScriptClientCodegenPlugin().execute(context);

        return manifest;
    }

    @Test
    public void notAnHttpApiKeyAuthClient() {
        testDoesNotInject("endpoint-trait.smithy");
    }

    @Test
    public void httpApiKeyAuthClientWithAllOptionalAuthOperations() {
        testDoesNotInject("http-api-key-auth-trait-all-optional.smithy");
    }

    private void testDoesNotInject(String filename) {
        MockManifest manifest = generate(filename);

        // Make sure that the config and middleware were not added to the client.
        assertThat(manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/ExampleClient.ts").get(),
                not(containsString("= resolveHttpApiKeyAuthConfig(")));
        assertThat(manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/ExampleClient.ts").get(),
                not(containsString("from \"./middleware/HttpApiKeyAuth\"")));

        // Make sure that the import and middleware were not used in the operation.
        assertThat(manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/commands/GetFooCommand.ts").get(),
                not(containsString("from \"../middleware/HttpApiKeyAuth\"")));
        assertThat(manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/commands/GetFooCommand.ts").get(),
                not(containsString("this.middlewareStack.use(getHttpApiKeyAuthPlugin(configuration")));

        // Make sure that the middleware file was not written.
        assertThat(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/middleware/HttpApiKeyAuth/index.ts"),
                is(false));

        // Ensure that the middleware was not being exported in the index file.
        assertThat(manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/index.ts").get(),
            not(containsString("from \"./middleware/HttpApiKeyAuth\"")));
    }
}
