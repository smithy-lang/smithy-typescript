/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.rulesengine.traits.EndpointRuleSetTrait;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generates a service endpoint resolver.
 */
@SmithyInternalApi
public final class EndpointsV2Generator implements Runnable {

    static final String ENDPOINT_FOLDER = "endpoint";

    private final FileManifest fileManifest;
    private final EndpointRuleSetTrait endpointRuleSetTrait;
    private final ServiceShape service;

    public EndpointsV2Generator(
            TypeScriptSettings settings,
            Model model,
            FileManifest fileManifest
    ) {
        this.fileManifest = fileManifest;
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
        TypeScriptWriter writer = new TypeScriptWriter("");

        writer.addImport("EndpointParameters", "__EndpointParameters", "@aws-sdk/types");

        writer.openBlock(
            "export interface ClientInputEndpointParameters {",
            "}",
            () -> {
                Map<String, String> clientContextParams =
                    new RuleSetParameterFinder(service).getClientContextParams();

                clientContextParams.forEach((k, v) -> {
                    writer.write("$L?: $L,", k, v);
                });
            }
        );

        writer.write("export type ClientResolvedEndpointParameters = ClientInputEndpointParameters;");

        writer.openBlock(
            "export const resolveClientEndpointParameters = "
                + "<T>(options: T & ClientInputEndpointParameters"
                + "): T & ClientResolvedEndpointParameters => {",
            "}",
            () -> {
                writer.openBlock("return {", "}", () -> {
                    writer.write("...options,");
                });
            }
        );

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

        fileManifest.writeFile(
            Paths.get(CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER, "EndpointParameters.ts").toString(),
            writer.toString()
        );
    }

    /**
     * Generate the resolver function for this service.
     */
    private void generateEndpointResolver() {
        TypeScriptWriter writer = new TypeScriptWriter("");

        writer.addImport("EndpointV2", null, "@aws-sdk/types");
        writer.addImport("Logger", null, "@aws-sdk/types");

        writer.addImport("EndpointParams", null, "@aws-sdk/util-endpoints");
        writer.addImport("resolveEndpoint", null, "@aws-sdk/util-endpoints");
        writer.addImport("EndpointParameters", null, "../endpoint/EndpointParameters");
        writer.addImport("ruleSet", null, "../endpoint/ruleset");

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

        fileManifest.writeFile(
            Paths.get(CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER, "endpointResolver.ts").toString(),
            writer.toString()
        );
    }

    /**
     * Generate the ruleset (dynamic resolution only).
     */
    private void generateEndpointRuleset() {
        TypeScriptWriter writer = new TypeScriptWriter("");

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

        fileManifest.writeFile(
            Paths.get(CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER, "ruleset.ts").toString(),
            writer.toString()
        );
    }
}
