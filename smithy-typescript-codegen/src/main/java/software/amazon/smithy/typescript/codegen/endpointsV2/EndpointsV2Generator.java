/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.endpointsV2;

import java.nio.file.Paths;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
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
                writer.addImport("EndpointParameters", "__EndpointParameters", TypeScriptDependency.SMITHY_TYPES);
                writer.addImport("Provider", null, TypeScriptDependency.SMITHY_TYPES);
                Map<String, String> clientContextParams =
                    ruleSetParameterFinder.getClientContextParams();
                Map<String, String> builtInParams = ruleSetParameterFinder.getBuiltInParams();
                builtInParams.keySet().removeIf(OmitEndpointParams::isOmitted);
                Set<String> knownConfigKeys = Set.of(
                    "apiKey", "retryStrategy", "requestHandler");
                // Generate clientContextParams with all params excluding built-ins
                Map<String, String> customerContextParams = new HashMap<>();
                for (Map.Entry<String, String> entry : clientContextParams.entrySet()) {
                    if (!builtInParams.containsKey(entry.getKey())) {
                        customerContextParams.put(entry.getKey(), entry.getValue());
                    }
                }

                writer.writeDocs("@public");
                writer.openBlock(
                    "export interface ClientInputEndpointParameters {",
                    "}",
                    () -> {
                        if (!customerContextParams.isEmpty()) {
                            writer.write("clientContextParams?: {");
                            writer.indent();
                            ObjectNode ruleSet = endpointRuleSetTrait.getRuleSet().expectObjectNode();
                            ruleSet.getObjectMember("parameters").ifPresent(parameters -> {
                                parameters.accept(new RuleSetParametersVisitor(
                                    writer, customerContextParams, true));
                            });
                            writer.dedent();
                            writer.write("};");
                        }
                        // Add direct params (built-ins + non-conflicting client context params)
                        Map<String, String> directParams = new HashMap<>(builtInParams);
                        for (Map.Entry<String, String> entry : clientContextParams.entrySet()) {
                            // Only add non-conflicting client context params that aren't built-ins
                            if (!knownConfigKeys.contains(entry.getKey())
                                && !builtInParams.containsKey(entry.getKey())) {
                                directParams.put(entry.getKey(), entry.getValue());
                            }
                        }
                        ObjectNode ruleSet = endpointRuleSetTrait.getRuleSet().expectObjectNode();
                        ruleSet.getObjectMember("parameters").ifPresent(parameters -> {
                            parameters.accept(new RuleSetParametersVisitor(writer, directParams, true));
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
                // Generate clientContextParamDefaults only if there are customer context params
                if (!customerContextParams.isEmpty()) {
                    // Check if any parameters have default values
                    boolean hasDefaults = false;
                    ObjectNode ruleSet = endpointRuleSetTrait.getRuleSet().expectObjectNode();
                    if (ruleSet.getObjectMember("parameters").isPresent()) {
                        ObjectNode parameters = ruleSet.getObjectMember("parameters").get().expectObjectNode();
                        for (Map.Entry<String, String> entry : customerContextParams.entrySet()) {
                            String paramName = entry.getKey();
                            ObjectNode paramNode = parameters.getObjectMember(paramName).orElse(null);
                            if (paramNode != null && paramNode.containsMember("default")) {
                                hasDefaults = true;
                                break;
                            }
                        }
                    }
                    if (hasDefaults) {
                        writer.write("");
                        writer.writeDocs("@internal");
                        writer.openBlock("const clientContextParamDefaults = {", "} as const;", () -> {
                            ruleSet.getObjectMember("parameters").ifPresent(parameters -> {
                                for (Map.Entry<String, String> entry : customerContextParams.entrySet()) {
                                    String paramName = entry.getKey();
                                    ObjectNode paramNode = parameters.expectObjectNode()
                                        .getObjectMember(paramName).orElse(null);
                                    if (paramNode != null && paramNode.containsMember("default")) {
                                        Node defaultValue = paramNode.getMember("default").get();
                                        if (defaultValue.isStringNode()) {
                                            writer.write("$L: \"$L\",", paramName,
                                                defaultValue.expectStringNode().getValue());
                                        } else if (defaultValue.isBooleanNode()) {
                                            writer.write("$L: $L,", paramName,
                                                defaultValue.expectBooleanNode().getValue());
                                        }
                                    }
                                }
                            });
                        });
                    }
                }
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
                            writer.write(
                                "defaultSigningName: \"$L\",",
                                settings.getDefaultSigningName()
                            );
                            // Only generate clientContextParams if there are customer context params
                            if (!customerContextParams.isEmpty()) {
                                // Initialize clientContextParams if undefined to satisfy type requirements
                                // Check if we have defaults to merge
                                boolean hasDefaultsForResolve = false;
                                if (ruleSet.getObjectMember("parameters").isPresent()) {
                                    ObjectNode parameters = ruleSet.getObjectMember("parameters")
                                        .get().expectObjectNode();
                                    for (Map.Entry<String, String> entry : customerContextParams.entrySet()) {
                                        String paramName = entry.getKey();
                                        ObjectNode paramNode = parameters.getObjectMember(paramName).orElse(null);
                                        if (paramNode != null && paramNode.containsMember("default")) {
                                            hasDefaultsForResolve = true;
                                            break;
                                        }
                                    }
                                }
                                if (hasDefaultsForResolve) {
                                    writer.write(
                                        "clientContextParams: Object.assign(clientContextParamDefaults, "
                                        + "options.clientContextParams ?? {}),"
                                    );
                                } else {
                                    writer.write(
                                        "clientContextParams: options.clientContextParams ?? {},"
                                    );
                                }
                            }
                        });
                    }
                );

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
