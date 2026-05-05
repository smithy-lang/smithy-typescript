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
import software.amazon.smithy.model.node.ArrayNode;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.rulesengine.language.syntax.rule.Condition;
import software.amazon.smithy.rulesengine.language.syntax.rule.Rule;
import software.amazon.smithy.rulesengine.logic.bdd.Bdd;
import software.amazon.smithy.rulesengine.traits.EndpointBddTrait;
import software.amazon.smithy.rulesengine.traits.EndpointRuleSetTrait;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.Dependency;
import software.amazon.smithy.typescript.codegen.SmithyCoreSubmodules;
import software.amazon.smithy.typescript.codegen.TypeScriptDelegator;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.util.PatternDetectionCompression;
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
    static final String ENDPOINT_BDD_FILE = "bdd.ts";

    private final TypeScriptDelegator delegator;
    private final EndpointRuleSetTrait endpointRuleSetTrait;
    private final EndpointBddTrait endpointBddTrait;
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
        endpointBddTrait = service.getTrait(EndpointBddTrait.class).orElse(ConvertBdd.convert(model, settings));
        ruleSetParameterFinder = new RuleSetParameterFinder(service);
    }

    @Override
    public void run() {
        generateEndpointParameters();
        generateEndpointResolver();
        if (settings.generateEndpointBdd()) {
            generateEndpointBdd();
        } else {
            generateEndpointRuleset();
        }
    }

    /**
     * Generate the EndpointParameters interface file specific to this service.
     */
    private void generateEndpointParameters() {
        this.delegator.useFileWriter(
            Paths.get(CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER, ENDPOINT_PARAMETERS_FILE).toString(),
            writer -> {
                writer.addTypeImport("EndpointParameters", "__EndpointParameters", TypeScriptDependency.SMITHY_TYPES);
                writer.addTypeImport("Provider", null, TypeScriptDependency.SMITHY_TYPES);
                Map<String, String> clientContextParams =
                    ruleSetParameterFinder.getClientContextParams();
                Map<String, String> builtInParams = ruleSetParameterFinder.getBuiltInParams();
                builtInParams.keySet().removeIf(OmitEndpointParams::isOmitted);
                Map<String, String> customContextParams = ClientConfigKeys.getCustomContextParams(
                    clientContextParams,
                    builtInParams
                );

                writer.writeDocs("@public");
                writer.openBlock(
                    "export interface ClientInputEndpointParameters {",
                    "}",
                    () -> {
                        // Only include client context params that are NOT built-ins
                        Map<String, String> clientContextParamsExcludingBuiltIns = new HashMap<>(clientContextParams);
                        clientContextParamsExcludingBuiltIns.keySet().removeAll(builtInParams.keySet());
                        if (!clientContextParamsExcludingBuiltIns.isEmpty()) {
                            writer.write("clientContextParams?: {");
                            writer.indent();
                            ObjectNode ruleSet = endpointRuleSetTrait.getRuleSet().expectObjectNode();
                            ruleSet.getObjectMember("parameters").ifPresent(parameters -> {
                                parameters.accept(
                                    new RuleSetParametersVisitor(
                                        writer,
                                        clientContextParamsExcludingBuiltIns,
                                        true
                                    )
                                );
                            });
                            writer.dedent();
                            writer.write("};");
                        }
                        // Add direct params (built-ins + custom context params, excluding conflicting)
                        Map<String, String> directParams = new HashMap<>();
                        // Add all built-ins (they should always be at root level, even if conflicting)
                        directParams.putAll(builtInParams);
                        // Add custom context params excluding conflicting ones
                        customContextParams.entrySet().forEach(entry -> {
                            String paramName = entry.getKey();
                            String localName = EndpointsParamNameMap
                                .getLocalName(paramName);
                            if (
                                !ClientConfigKeys.isKnownConfigKey(paramName)
                                    && !ClientConfigKeys.isKnownConfigKey(localName)
                            ) {
                                directParams.put(paramName, entry.getValue());
                            }
                        });
                        ObjectNode ruleSet = endpointRuleSetTrait.getRuleSet().expectObjectNode();
                        ruleSet.getObjectMember("parameters").ifPresent(parameters -> {
                            parameters.accept(new RuleSetParametersVisitor(writer, directParams, true));
                        });
                    }
                );

                writer.write("");
                writer.writeDocs("@public");
                writer.write(
                    """
                    export type ClientResolvedEndpointParameters = Omit<ClientInputEndpointParameters, "endpoint"> & {
                      defaultSigningName: string;
                    };"""
                );
                if (ruleSetParameterFinder.hasCustomClientContextParams()) {
                    ruleSetParameterFinder.writeNestedClientContextParamDefaults(writer);
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
                        if (ruleSetParameterFinder.hasCustomClientContextParams()) {
                            ruleSetParameterFinder.writeConfigResolverNestedClientContextParams(writer);
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

                writer.addDependency(TypeScriptDependency.SMITHY_CORE);
                writer.addTypeImportSubmodule(
                    "EndpointParams",
                    null,
                    TypeScriptDependency.SMITHY_CORE,
                    SmithyCoreSubmodules.ENDPOINTS
                );
                if (settings.generateEndpointBdd()) {
                    writer.addImportSubmodule(
                        "decideEndpoint",
                        null,
                        TypeScriptDependency.SMITHY_CORE,
                        SmithyCoreSubmodules.ENDPOINTS
                    );
                    writer.addRelativeImport(
                        "bdd",
                        null,
                        Paths.get(
                            ".",
                            CodegenUtils.SOURCE_FOLDER,
                            ENDPOINT_FOLDER,
                            ENDPOINT_BDD_FILE.replace(".ts", "")
                        )
                    );
                } else {
                    writer.addImportSubmodule(
                        "resolveEndpoint",
                        null,
                        TypeScriptDependency.SMITHY_CORE,
                        SmithyCoreSubmodules.ENDPOINTS
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
                }
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

                writer.addImportSubmodule(
                    "EndpointCache",
                    null,
                    TypeScriptDependency.SMITHY_CORE,
                    SmithyCoreSubmodules.ENDPOINTS
                );

                List<String> effectiveParams = ruleSetParameterFinder.getEffectiveParams();
                boolean longList = effectiveParams.size() >= 8;

                if (longList) {
                    writer.openBlock("const cache = new EndpointCache({", "});", () -> {
                        writer.write("size: 50,");
                        writer.openBlock("params: [", "],", () -> {
                            effectiveParams
                                .forEach(param -> {
                                    writer.write("$S,", param);
                                });
                        });
                    });
                    writer.write("");
                } else {
                    writer.write(
                        """
                        const cache = new EndpointCache({
                          size: 50,
                          params: [$L],
                        });
                        """,
                        effectiveParams
                            .stream()
                            .collect(Collectors.joining("\", \"", "\"", "\""))
                    );
                }
                writer.writeDocs("@internal");
                writer.write(
                    """
                    export const defaultEndpointResolver = (
                      endpointParams: EndpointParameters,
                      context: { logger?: Logger } = {}
                    ): EndpointV2 => {
                      return cache.get(endpointParams as EndpointParams, () =>
                        $L, {
                          endpointParams: endpointParams as EndpointParams,
                          logger: context.logger,
                        })
                      );
                    };
                    """,
                    settings.generateEndpointBdd() ? "decideEndpoint(bdd" : "resolveEndpoint(ruleSet"
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

    private void generateEndpointBdd() {
        if (endpointBddTrait == null) {
            throw new RuntimeException("generateEndpointBdd() called but endpointBddTrait is null.");
        }

        this.delegator.useFileWriter(
            Paths.get(CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER, ENDPOINT_BDD_FILE).toString(),
            writer -> {
                ObjectNode conditionsAndResults = ObjectNode.fromStringMap(Collections.emptyMap());

                List<Condition> conditions = endpointBddTrait.getConditions();
                conditionsAndResults = conditionsAndResults.withMember(
                    "conditions",
                    ArrayNode.fromNodes(
                        conditions.stream().map(c -> new ConditionSerializer(c).toArrayNode()).toList()
                    )
                );

                List<Rule> results = endpointBddTrait.getResults();
                conditionsAndResults = conditionsAndResults.withMember(
                    "results",
                    ArrayNode.fromNodes(
                        results.stream().map(r -> new RuleSerializer(r).toArrayNode()).toList()
                    )
                );

                writer.write(
                    new PatternDetectionCompression(conditionsAndResults).compress()
                );

                Bdd bdd = endpointBddTrait.getBdd();

                writer.write(
                    """
                    const root = $L;
                    const r = 100_000_000;
                    const nodes = new Int32Array([""",
                    endpointBddTrait.getBdd().getRootRef()
                ).indent();

                bdd.getNodes((i, hi, lo) -> {
                    writer.write(
                        """
                        $L, $L, $L,""",
                        shortestJsLiteral(i),
                        shortestJsLiteral(hi),
                        shortestJsLiteral(lo)
                    );
                });

                writer.dedent().write("""
                                      ]);""");
                writer.addImportSubmodule(
                    "BinaryDecisionDiagram",
                    null,
                    TypeScriptDependency.SMITHY_CORE,
                    SmithyCoreSubmodules.ENDPOINTS
                );
                writer.write("""
                             export const bdd = BinaryDecisionDiagram.from(
                               nodes, root, _data.conditions, _data.results
                             );""");
            }
        );
    }

    private static String shortestJsLiteral(int value) {
        String decimal = Integer.toString(value);
        String hex = "0x" + Integer.toHexString(value).toUpperCase();
        String octal = "0o" + Integer.toOctalString(value);
        String binary = "0b" + Integer.toBinaryString(value);

        String shortest = decimal;
        if (hex.length() < shortest.length()) {
            shortest = hex;
        }
        if (octal.length() < shortest.length()) {
            shortest = octal;
        }
        if (binary.length() < shortest.length()) {
            shortest = binary;
        }

        if (shortest.equals(decimal) && value >= 100000000) {
            return "r + " + (value - 100000000);
        }

        return shortest;
    }
}
