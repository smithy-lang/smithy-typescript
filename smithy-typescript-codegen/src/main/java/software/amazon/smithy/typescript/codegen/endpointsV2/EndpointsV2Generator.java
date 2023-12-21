/*
 * Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

package software.amazon.smithy.typescript.codegen.endpointsV2;

import java.nio.file.Paths;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.rulesengine.traits.EndpointRuleSetTrait;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.Dependency;
import software.amazon.smithy.typescript.codegen.TypeScriptDelegator;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generates a service endpoint resolver.
 */
@SmithyInternalApi
public final class EndpointsV2Generator implements Runnable {

    public static final String ENDPOINT_FOLDER = "endpoint";
    public static final String ENDPOINT_PARAMETERS_MODULE_NAME = "EndpointParameters";
    public static final String ENDPOINT_RESOLVER_MODULE_NAME = "endpointResolver";
    public static final String ENDPOINT_PARAMETERS_MODULE =
        Paths.get(".", CodegenUtils.SOURCE_FOLDER, EndpointsV2Generator.ENDPOINT_FOLDER,
            EndpointsV2Generator.ENDPOINT_PARAMETERS_MODULE_NAME).toString();
    public static final Dependency ENDPOINT_PARAMETERS_DEPENDENCY = new Dependency() {
        @Override
        public String getPackageName() {
            return ENDPOINT_PARAMETERS_MODULE;
        }

        @Override
        public List<SymbolDependency> getDependencies() {
            return Collections.emptyList();
        }
    };
    public static final String ENDPOINT_RESOLVER_MODULE =
        Paths.get(".", CodegenUtils.SOURCE_FOLDER, EndpointsV2Generator.ENDPOINT_FOLDER,
            EndpointsV2Generator.ENDPOINT_RESOLVER_MODULE_NAME).toString();
    public static final Dependency ENDPOINT_RESOLVER_DEPENDENCY = new Dependency() {
        @Override
        public String getPackageName() {
            return ENDPOINT_RESOLVER_MODULE;
        }

        @Override
        public List<SymbolDependency> getDependencies() {
            return Collections.emptyList();
        }
    };

    static final String ENDPOINT_PARAMETERS_FILE = ENDPOINT_PARAMETERS_MODULE_NAME + ".ts";
    static final String ENDPOINT_RESOLVER_FILE = ENDPOINT_RESOLVER_MODULE_NAME + ".ts";
    static final String ENDPOINT_RULESET_FILE = "ruleset.ts";

    private final TypeScriptDelegator delegator;
    private final EndpointRuleSetTrait endpointRuleSetTrait;
    private final ServiceShape service;
    private final TypeScriptSettings settings;

    public EndpointsV2Generator(
            TypeScriptDelegator delegator,
            TypeScriptSettings settings,
            Model model
    ) {
        this.delegator = delegator;
        service = settings.getService(model);
        this.settings = settings;
        endpointRuleSetTrait = service.getTrait(EndpointRuleSetTrait.class)
            .orElseThrow(() -> new RuntimeException("service missing EndpointRuleSetTrait"));
    }

    @Override
    public void run() {
        generateEndpointParameters();
        generateEndpointResolver();
        generateEndpointRuleset();
    }

    /**
     * Generate the EndpointParameters interface file specific to this service.
     */
    private void generateEndpointParameters() {
        this.delegator.useFileWriter(
            Paths.get(CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER, ENDPOINT_PARAMETERS_FILE).toString(),
            writer -> {
                writer.addImport("EndpointParameters", "__EndpointParameters", TypeScriptDependency.SMITHY_TYPES);
                writer.addImport("Provider", null, TypeScriptDependency.SMITHY_TYPES);

                writer.writeDocs("@public");
                writer.openBlock(
                    "export interface ClientInputEndpointParameters {",
                    "}",
                    () -> {
                        RuleSetParameterFinder ruleSetParameterFinder = new RuleSetParameterFinder(service);

                        Map<String, String> clientInputParams = ruleSetParameterFinder.getClientContextParams();
                        clientInputParams.putAll(ruleSetParameterFinder.getBuiltInParams());

                        ObjectNode ruleSet = endpointRuleSetTrait.getRuleSet().expectObjectNode();
                        ruleSet.getObjectMember("parameters").ifPresent(parameters -> {
                            parameters.accept(new RuleSetParametersVisitor(writer, clientInputParams, true));
                        });
                    }
                );

                writer.write("");
                writer.openBlock(
                    "export type ClientResolvedEndpointParameters = ClientInputEndpointParameters & {",
                    "};",
                    () -> {
                        writer.write("defaultSigningName: string;");
                    }
                );
                writer.write("");

                writer.openBlock(
                    "export const resolveClientEndpointParameters = "
                        + "<T>(options: T & ClientInputEndpointParameters"
                        + "): T & ClientResolvedEndpointParameters => {",
                    "}",
                    () -> {
                        writer.openBlock("return {", "}", () -> {
                            writer.write("...options,");
                            ObjectNode ruleSet = endpointRuleSetTrait.getRuleSet().expectObjectNode();
                            ruleSet.getObjectMember("parameters").ifPresent(parameters -> {
                                parameters.accept(new RuleSetParametersVisitor(writer, true));
                            });
                            writer.write(
                                "defaultSigningName: \"$L\",",
                                settings.getDefaultSigningName()
                            );
                        });
                    }
                );

                writer.write("");

                writer.openBlock(
                    "export const commonParams = {", "} as const",
                    () -> {
                        RuleSetParameterFinder parameterFinder = new RuleSetParameterFinder(service);
                        Set<String> paramNames = new HashSet<>();

                        parameterFinder.getClientContextParams().forEach((name, type) -> {
                            if (!paramNames.contains(name)) {
                                writer.write(
                                    "$L: { type: \"clientContextParams\", name: \"$L\" },",
                                    name, EndpointsParamNameMap.getLocalName(name));
                            }
                            paramNames.add(name);
                        });

                        parameterFinder.getBuiltInParams().forEach((name, type) -> {
                            if (!paramNames.contains(name)) {
                                writer.write(
                                    "$L: { type: \"builtInParams\", name: \"$L\" },",
                                    name, EndpointsParamNameMap.getLocalName(name));
                            }
                            paramNames.add(name);
                        });
                    }
                );

                writer.write("");
                writer.openBlock(
                    "export interface EndpointParameters extends __EndpointParameters {",
                    "}",
                    () -> {
                        ObjectNode ruleSet = endpointRuleSetTrait.getRuleSet().expectObjectNode();
                        ruleSet.getObjectMember("parameters").ifPresent(parameters -> {
                            parameters.accept(new RuleSetParametersVisitor(writer));
                        });
                    }
                );
            }
        );
    }

    /**
     * Generate the resolver function for this service.
     */
    private void generateEndpointResolver() {
        this.delegator.useFileWriter(
            Paths.get(CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER, ENDPOINT_RESOLVER_FILE).toString(),
            writer -> {
                writer.addImport("EndpointV2", null, TypeScriptDependency.SMITHY_TYPES);
                writer.addImport("Logger", null, TypeScriptDependency.SMITHY_TYPES);

                writer.addDependency(TypeScriptDependency.UTIL_ENDPOINTS);
                writer.addImport("EndpointParams", null, TypeScriptDependency.UTIL_ENDPOINTS);
                writer.addImport("resolveEndpoint", null, TypeScriptDependency.UTIL_ENDPOINTS);
                writer.addRelativeImport("EndpointParameters", null,
                    Paths.get(".", CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER,
                        ENDPOINT_PARAMETERS_FILE.replace(".ts", "")));
                writer.addRelativeImport("ruleSet", null,
                    Paths.get(".", CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER,
                        ENDPOINT_RULESET_FILE.replace(".ts", "")));

                writer.openBlock(
                    "export const defaultEndpointResolver = ",
                    "",
                    () -> {
                        writer.openBlock(
                            "(endpointParams: EndpointParameters, context: { logger?: Logger } = {}): EndpointV2 => {",
                            "};",
                            () -> {
                                writer.openBlock(
                                    "return resolveEndpoint(ruleSet, {",
                                    "});",
                                    () -> {
                                        writer.write("endpointParams: endpointParams as EndpointParams,");
                                        writer.write("logger: context.logger,");
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    }

    /**
     * Generate the ruleset (dynamic resolution only).
     */
    private void generateEndpointRuleset() {
        this.delegator.useFileWriter(
            Paths.get(CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER, ENDPOINT_RULESET_FILE).toString(),
            writer -> {
                writer.addImport("RuleSetObject", null, TypeScriptDependency.SMITHY_TYPES);
                writer.openBlock(
                    "export const ruleSet: RuleSetObject = ",
                    ";",
                    () -> {
                        new RuleSetSerializer(
                            endpointRuleSetTrait.getRuleSet(),
                            writer
                        ).generate();
                    }
                );

            }
        );
    }
}
