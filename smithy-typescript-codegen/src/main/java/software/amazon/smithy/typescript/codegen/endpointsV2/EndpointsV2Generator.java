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
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import software.amazon.smithy.aws.traits.ServiceTrait;
import software.amazon.smithy.aws.traits.auth.SigV4Trait;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.rulesengine.traits.EndpointRuleSetTrait;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.TypeScriptDelegator;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generates a service endpoint resolver.
 */
@SmithyInternalApi
public final class EndpointsV2Generator implements Runnable {

    static final String ENDPOINT_FOLDER = "endpoint";
    static final String ENDPOINT_PARAMETERS_FILE = "EndpointParameters.ts";
    static final String ENDPOINT_RESOLVER_FILE = "endpointResolver.ts";
    static final String ENDPOINT_RULESET_FILE = "ruleset.ts";

    private final TypeScriptDelegator delegator;
    private final EndpointRuleSetTrait endpointRuleSetTrait;
    private final ServiceShape service;

    public EndpointsV2Generator(
            TypeScriptDelegator delegator,
            TypeScriptSettings settings,
            Model model
    ) {
        this.delegator = delegator;
        service = settings.getService(model);
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
                writer.addImport("EndpointParameters", "__EndpointParameters", "@aws-sdk/types");
                writer.addImport("Provider", null, "@aws-sdk/types");

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
                            writer.write("defaultSigningName: \"$L\",", defaultSigningName());
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

    private String defaultSigningName() {
      Optional<SigV4Trait> sigv4Trait = service.getTrait(SigV4Trait.class);
      if (sigv4Trait.isPresent()) {
        return sigv4Trait.get().getName();
      }
      Optional<ServiceTrait> serviceTrait = service.getTrait(ServiceTrait.class);
      if (serviceTrait.isPresent()) {
        return serviceTrait.get().getArnNamespace();
      }
      throw new NoSuchElementException(String.format(
                "No %s or %s trait, required for Endpoint default signing name",
                SigV4Trait.ID,
                ServiceTrait.ID));
    }

    /**
     * Generate the resolver function for this service.
     */
    private void generateEndpointResolver() {
        this.delegator.useFileWriter(
            Paths.get(CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER, ENDPOINT_RESOLVER_FILE).toString(),
            writer -> {
                writer.addImport("EndpointV2", null, "@aws-sdk/types");
                writer.addImport("Logger", null, "@aws-sdk/types");

                writer.addDependency(TypeScriptDependency.AWS_SDK_UTIL_ENDPOINTS);
                writer.addImport("EndpointParams", null, TypeScriptDependency.AWS_SDK_UTIL_ENDPOINTS.packageName);
                writer.addImport("resolveEndpoint", null, TypeScriptDependency.AWS_SDK_UTIL_ENDPOINTS.packageName);
                writer.addImport("EndpointParameters", null,
                    Paths.get(".", CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER,
                        ENDPOINT_PARAMETERS_FILE.replace(".ts", "")).toString());
                writer.addImport("ruleSet", null,
                    Paths.get(".", CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER,
                        ENDPOINT_RULESET_FILE.replace(".ts", "")).toString());

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
                writer.addImport("RuleSetObject", null, "@aws-sdk/util-endpoints");
                writer.openBlock(
                    "export const ruleSet: RuleSetObject = ",
                    "",
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
