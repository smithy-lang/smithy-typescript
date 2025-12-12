/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.endpointsV2;

import java.nio.file.Paths;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
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
    public static final String ENDPOINT_PARAMETERS_MODULE = Paths.get(
        ".",
        CodegenUtils.SOURCE_FOLDER,
        EndpointsV2Generator.ENDPOINT_FOLDER,
        EndpointsV2Generator.ENDPOINT_PARAMETERS_MODULE_NAME
    ).toString();
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
    public static final String ENDPOINT_RESOLVER_MODULE = Paths.get(
        ".",
        CodegenUtils.SOURCE_FOLDER,
        EndpointsV2Generator.ENDPOINT_FOLDER,
        EndpointsV2Generator.ENDPOINT_RESOLVER_MODULE_NAME
    ).toString();
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
    private final RuleSetParameterFinder ruleSetParameterFinder;

    public EndpointsV2Generator(TypeScriptDelegator delegator, TypeScriptSettings settings, Model model) {
        this.delegator = delegator;
        service = settings.getService(model);
        this.settings = settings;
        endpointRuleSetTrait = service
            .getTrait(EndpointRuleSetTrait.class)
            .orElseThrow(() -> new RuntimeException("service or model preprocessor missing EndpointRuleSetTrait"));
        ruleSetParameterFinder = new RuleSetParameterFinder(service);
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
                writer.addTypeImport(
                    "EndpointParameters",
                    "__EndpointParameters",
                    TypeScriptDependency.SMITHY_TYPES
                );
                writer.addTypeImport("Provider", null, TypeScriptDependency.SMITHY_TYPES);

                writer.writeDocs("@public");
                writer.openBlock("export interface ClientInputEndpointParameters {", "}", () -> {
                    Map<String, String> clientInputParams = ruleSetParameterFinder.getClientContextParams();
                    //Omit Endpoint params that should not be a part of the ClientInputEndpointParameters interface
                    Map<String, String> builtInParams = ruleSetParameterFinder.getBuiltInParams();
                    builtInParams.keySet().removeIf(OmitEndpointParams::isOmitted);
                    clientInputParams.putAll(builtInParams);

                    ObjectNode ruleSet = endpointRuleSetTrait.getRuleSet().expectObjectNode();
                    ruleSet
                        .getObjectMember("parameters")
                        .ifPresent(parameters -> {
                            parameters.accept(new RuleSetParametersVisitor(writer, clientInputParams, true));
                        });
                });

                writer.write("");
                writer.writeDocs("@public");
                writer.write(
                    """
                    export type ClientResolvedEndpointParameters = Omit<ClientInputEndpointParameters, "endpoint"> & {
                      defaultSigningName: string;
                    };"""
                );
                writer.write("");

                writer.writeDocs("@internal");
                writer.openBlock("""
                                 export const resolveClientEndpointParameters = <T>(
                                   options: T & ClientInputEndpointParameters
                                 ): T & ClientResolvedEndpointParameters => {""", "};", () -> {
                    writer.openBlock("return Object.assign(options, {", "});", () -> {
                        ObjectNode ruleSet = endpointRuleSetTrait.getRuleSet().expectObjectNode();
                        ruleSet
                            .getObjectMember("parameters")
                            .ifPresent(parameters -> {
                                parameters.accept(new RuleSetParametersVisitor(writer, true));
                            });
                        writer.write("defaultSigningName: \"$L\",", settings.getDefaultSigningName());
                    });
                });

                writer.write("");

                writer.writeDocs("@internal");
                writer.openBlock("export const commonParams = {", "} as const;", () -> {
                    Set<String> paramNames = new HashSet<>();

                    ruleSetParameterFinder
                        .getClientContextParams()
                        .forEach((name, type) -> {
                            if (!paramNames.contains(name)) {
                                writer.write(
                                    "$L: { type: \"clientContextParams\", name: \"$L\" },",
                                    name,
                                    EndpointsParamNameMap.getLocalName(name)
                                );
                            }
                            paramNames.add(name);
                        });

                    ruleSetParameterFinder
                        .getBuiltInParams()
                        .forEach((name, type) -> {
                            if (!paramNames.contains(name)) {
                                writer.write(
                                    "$L: { type: \"builtInParams\", name: \"$L\" },",
                                    name,
                                    EndpointsParamNameMap.getLocalName(name)
                                );
                            }
                            paramNames.add(name);
                        });
                });

                writer.write("");
                writer.writeDocs("@internal");
                writer.openBlock("export interface EndpointParameters extends __EndpointParameters {", "}", () -> {
                    ObjectNode ruleSet = endpointRuleSetTrait.getRuleSet().expectObjectNode();
                    ruleSet
                        .getObjectMember("parameters")
                        .ifPresent(parameters -> {
                            parameters.accept(new RuleSetParametersVisitor(writer));
                        });
                });
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
                writer.addTypeImport("EndpointV2", null, TypeScriptDependency.SMITHY_TYPES);
                writer.addTypeImport("Logger", null, TypeScriptDependency.SMITHY_TYPES);

                writer.addDependency(TypeScriptDependency.UTIL_ENDPOINTS);
                writer.addTypeImport("EndpointParams", null, TypeScriptDependency.UTIL_ENDPOINTS);
                writer.addImport("resolveEndpoint", null, TypeScriptDependency.UTIL_ENDPOINTS);
                writer.addRelativeTypeImport(
                    "EndpointParameters",
                    null,
                    Paths.get(
                        ".",
                        CodegenUtils.SOURCE_FOLDER,
                        ENDPOINT_FOLDER,
                        ENDPOINT_PARAMETERS_FILE.replace(".ts", "")
                    )
                );
                writer.addRelativeImport(
                    "ruleSet",
                    null,
                    Paths.get(
                        ".",
                        CodegenUtils.SOURCE_FOLDER,
                        ENDPOINT_FOLDER,
                        ENDPOINT_RULESET_FILE.replace(".ts", "")
                    )
                );

                writer.addImport("EndpointCache", null, TypeScriptDependency.UTIL_ENDPOINTS);
                writer.write(
                    """
                    const cache = new EndpointCache({
                      size: 50,
                      params: [$L],
                    });
                    """,
                    ruleSetParameterFinder
                        .getEffectiveParams()
                        .stream()
                        .collect(Collectors.joining("\",\n \"", "\"", "\""))
                );

                writer.writeDocs("@internal");
                writer.write(
                    """
                    export const defaultEndpointResolver = (
                      endpointParams: EndpointParameters,
                      context: { logger?: Logger } = {}
                    ): EndpointV2 => {
                      return cache.get(endpointParams as EndpointParams, () =>
                        resolveEndpoint(ruleSet, {
                          endpointParams: endpointParams as EndpointParams,
                          logger: context.logger,
                        })
                      );
                    };
                    """
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
                writer.addTypeImport("RuleSetObject", null, TypeScriptDependency.SMITHY_TYPES);

                writer.writeInline("export const ruleSet: RuleSetObject = ");
                new RuleSetSerializer(endpointRuleSetTrait.getRuleSet(), writer).generate();
            }
        );
    }
}
