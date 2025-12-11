/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.endpointsV2;

import static software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin.Convention.HAS_CONFIG;

import java.nio.file.Paths;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.rulesengine.traits.EndpointRuleSetTrait;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.AddBuiltinPlugins;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.utils.MapUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * This class normalizes models without endpointRuleSet traits to use the same code paths as those with ruleSet,
 * to make reasoning about models easier and less variable.
 */
@SmithyInternalApi
public class AddDefaultEndpointRuleSet implements TypeScriptIntegration {
    public static final EndpointRuleSetTrait DEFAULT_RULESET = EndpointRuleSetTrait.builder()
            .ruleSet(Node.parse("""
                    {
                      "version": "1.0",
                      "parameters": {
                        "endpoint": {
                          "type": "string",
                          "builtIn": "SDK::Endpoint",
                          "documentation": "Endpoint used for making requests. Should be formatted as a URI."
                        }
                      },
                      "rules": [
                        {
                          "conditions": [
                            {
                              "fn": "isSet",
                              "argv": [
                                {
                                  "ref": "endpoint"
                                }
                              ]
                            }
                          ],
                          "endpoint": {
                            "url": {
                              "ref": "endpoint"
                            }
                          },
                          "type": "endpoint"
                        },
                        {
                          "conditions": [],
                          "error": "(default endpointRuleSet) endpoint is not set - you must configure an endpoint.",
                          "type": "error"
                        }
                      ]
                    }
                    """))
            .build();

    private boolean usesDefaultEndpointRuleset = false;

    @Override
    public List<String> runAfter() {
        return List.of(AddBuiltinPlugins.class.getCanonicalName());
    }

    @Override
    public List<RuntimeClientPlugin> getClientPlugins() {
        RuntimeClientPlugin endpointConfigResolver = RuntimeClientPlugin.builder()
                .withConventions(
                        TypeScriptDependency.MIDDLEWARE_ENDPOINTS_V2.dependency,
                        "Endpoint",
                        HAS_CONFIG)
                .build();

        if (usesDefaultEndpointRuleset) {
            return List.of(
                    endpointConfigResolver,
                    RuntimeClientPlugin.builder()
                            .withConventions(
                                    TypeScriptDependency.MIDDLEWARE_ENDPOINTS_V2.dependency,
                                    "EndpointRequired",
                                    HAS_CONFIG)
                            .build());
        }
        return List.of(
                endpointConfigResolver);
    }

    @Override
    public Model preprocessModel(Model model, TypeScriptSettings settings) {
        Model.Builder modelBuilder = model.toBuilder();

        ServiceShape serviceShape = settings.getService(model);
        if (!serviceShape.hasTrait(EndpointRuleSetTrait.class)) {
            usesDefaultEndpointRuleset = true;
            modelBuilder.removeShape(serviceShape.toShapeId());
            modelBuilder.addShape(serviceShape.toBuilder()
                    .addTrait(DEFAULT_RULESET)
                    .build());
        }

        return modelBuilder.build();
    }

    @Override
    public Map<String, Consumer<TypeScriptWriter>> getRuntimeConfigWriters(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            LanguageTarget target
    ) {
        if (!settings.generateClient()) {
            return Collections.emptyMap();
        }
        if (target == LanguageTarget.SHARED) {
            return MapUtils.of("endpointProvider", writer -> {
                writer.addImport("defaultEndpointResolver",
                        null,
                        Paths.get(".", CodegenUtils.SOURCE_FOLDER, "endpoint/endpointResolver").toString());
                writer.write("defaultEndpointResolver");
            });
        }
        return Collections.emptyMap();
    }
}
