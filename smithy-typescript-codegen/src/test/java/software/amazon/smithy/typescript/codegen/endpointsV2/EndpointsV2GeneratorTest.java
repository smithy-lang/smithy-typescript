/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.endpointsV2;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.TypeScriptCodegenPlugin;

public class EndpointsV2GeneratorTest {

    @Test
    public void containsTrailingSemicolon() {
        MockManifest manifest = testEndpoints("endpoints.smithy");

        String ruleset = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/endpoint/ruleset.ts").get();

        assertEquals(
            """
            // smithy-typescript generated code
            import type { RuleSetObject } from "@smithy/types";

            export const ruleSet: RuleSetObject = {
              version: "1.3",
              parameters: {
                Region: {
                  type: "String",
                  documentation: "The region to dispatch this request, eg. `us-east-1`.",
                },
                Stage: {
                  type: "String",
                  required: true,
                  default: "production",
                },
                Endpoint: {
                  builtIn: "SDK::Endpoint",
                  type: "String",
                  required: false,
                  documentation: "Override the endpoint used to send this request",
                },
              },
              rules: [
                {
                  conditions: [
                    {
                      fn: "isSet",
                      argv: [
                        {
                          ref: "Endpoint",
                        },
                      ],
                    },
                    {
                      fn: "parseURL",
                      argv: [
                        {
                          ref: "Endpoint",
                        },
                      ],
                      assign: "url",
                    },
                  ],
                  endpoint: {
                    url: {
                      ref: "Endpoint",
                    },
                    properties: {},
                    headers: {},
                  },
                  type: "endpoint",
                },
                {
                  documentation: "Template the region into the URI when region is set",
                  conditions: [
                    {
                      fn: "isSet",
                      argv: [
                        {
                          ref: "Region",
                        },
                      ],
                    },
                  ],
                  type: "tree",
                  rules: [
                    {
                      conditions: [
                        {
                          fn: "stringEquals",
                          argv: [
                            {
                              ref: "Stage",
                            },
                            "staging",
                          ],
                        },
                      ],
                      endpoint: {
                        url: "https://{Region}.staging.example.com/2023-01-01",
                        properties: {},
                        headers: {},
                      },
                      type: "endpoint",
                    },
                    {
                      conditions: [],
                      endpoint: {
                        url: "https://{Region}.example.com/2023-01-01",
                        properties: {},
                        headers: {},
                      },
                      type: "endpoint",
                    },
                  ],
                },
                {
                  documentation: "Fallback when region is unset",
                  conditions: [],
                  error: "Region must be set to resolve a valid endpoint",
                  type: "error",
                },
              ],
            };
            """,
            ruleset
        );
    }

    @Test
    public void containsExtraContextParameter() {
        MockManifest manifest = testEndpoints("endpoints.smithy");

        String ruleset = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/endpoint/ruleset.ts").get();

        assertThat(
            ruleset,
            containsString(
                """
                    },
                    Stage: {
                      type: "String",
                      required: true,
                      default: "production",
                    },
                """
            )
        );

        String endpointParameters = manifest
            .getFileString(CodegenUtils.SOURCE_FOLDER + "/endpoint/EndpointParameters.ts")
            .get();

        assertThat(
            endpointParameters,
            containsString(
                """
                  return Object.assign(options, {
                    stage: options.stage ?? "production",
                    defaultSigningName: "",
                  });
                """
            )
        );
        assertThat(
            endpointParameters,
            containsString(
                """
                export interface ClientInputEndpointParameters {
                  region?: string | undefined | Provider<string | undefined>;
                  stage?: string | undefined | Provider<string | undefined>;
                  endpoint?:"""
            )
        );
    }

    private MockManifest testEndpoints(String filename) {
        MockManifest manifest = new MockManifest();
        PluginContext context = PluginContext.builder()
            .pluginClassLoader(getClass().getClassLoader())
            .model(
                Model.assembler()
                    .addImport(getClass().getResource(filename))
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

        assertThat(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/endpoint/EndpointParameters.ts"), is(true));
        assertThat(manifest.hasFile(CodegenUtils.SOURCE_FOLDER + "/endpoint/endpointResolver.ts"), is(true));

        String contents = manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/endpoint/ruleset.ts").get();

        assertThat(contents, containsString("export const ruleSet: RuleSetObject"));

        return manifest;
    }
}
