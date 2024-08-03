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

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.NodeVisitor;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.node.StringNode;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.rulesengine.traits.ClientContextParamsTrait;
import software.amazon.smithy.rulesengine.traits.ContextParamTrait;
import software.amazon.smithy.rulesengine.traits.EndpointRuleSetTrait;
import software.amazon.smithy.rulesengine.traits.StaticContextParamsTrait;
import software.amazon.smithy.utils.SmithyInternalApi;

@SmithyInternalApi
public class RuleSetParameterFinder {
    private final ServiceShape service;
    private final EndpointRuleSetTrait ruleset;

    public RuleSetParameterFinder(ServiceShape service) {
        this.service = service;
        this.ruleset = service.getTrait(EndpointRuleSetTrait.class).orElseThrow(
            () -> new RuntimeException("Service does not have EndpointRuleSetTrait.")
        );
    }

    /**
     * TODO(endpointsv2) From definitions in EndpointRuleSet.parameters, or
     * TODO(endpointsv2) are they from the closed set?
     */
    public Map<String, String> getBuiltInParams() {
        Map<String, String> map = new HashMap<>();
        ObjectNode ruleSet = ruleset.getRuleSet().expectObjectNode();
        ruleSet.getObjectMember("parameters").ifPresent(parameters -> {
            parameters.accept(new RuleSetParameterFinderVisitor(map));
        });
        return map;
    }

    /**
     * Defined on the service shape as smithy.rules#clientContextParams traits.
     */
    public Map<String, String> getClientContextParams() {
        Map<String, String> map = new HashMap<>();
        Optional<ClientContextParamsTrait> trait = service.getTrait(ClientContextParamsTrait.class);
        if (trait.isPresent()) {
            ClientContextParamsTrait clientContextParamsTrait = trait.get();
            clientContextParamsTrait.getParameters().forEach((name, definition) -> {
                map.put(
                    name,
                    definition.getType().toString().toLowerCase() // "boolean" and "string" are directly usable in TS.
                );
            });
        }
        return map;
    }

    /**
     * Get map of params to actual values instead of the value type.
     */
    public Map<String, String> getStaticContextParamValues(OperationShape operation) {
        Map<String, String> map = new HashMap<>();

        Optional<StaticContextParamsTrait> trait = operation.getTrait(StaticContextParamsTrait.class);
        if (trait.isPresent()) {
            StaticContextParamsTrait staticContextParamsTrait = trait.get();
            staticContextParamsTrait.getParameters().forEach((name, definition) -> {
                String value;
                if (definition.getValue().isStringNode()) {
                    value = "`" + definition.getValue().expectStringNode().toString() + "`";
                } else if (definition.getValue().isBooleanNode()) {
                    value = definition.getValue().expectBooleanNode().toString();
                } else {
                    throw new RuntimeException("unexpected type "
                        + definition.getValue().getType().toString()
                        + " received as staticContextParam.");
                }
                map.put(
                    name,
                    value
                );
            });
        }

        return map;
    }

    /**
     * The contextParam trait allows for binding a structure's member value to a context
     * parameter name. This trait MUST target a member shape on an operation's input structure.
     * The targeted endpoint parameter MUST be a type that is compatible with member's
     * shape targeted by the trait.
     */
    public Map<String, String> getContextParams(Shape operationInput) {
        Map<String, String> map = new HashMap<>();

        if (operationInput.isStructureShape()) {
            operationInput.getAllMembers().forEach((String memberName, MemberShape member) -> {
                Optional<ContextParamTrait> trait = member.getTrait(ContextParamTrait.class);
                if (trait.isPresent()) {
                    ContextParamTrait contextParamTrait = trait.get();
                    String name = contextParamTrait.getName();
                    map.put(
                        name,
                        "unknown"
                    );
                }
            });
        }

        return map;
    }

    private static class RuleSetParameterFinderVisitor extends NodeVisitor.Default<Void> {
        private final Map<String, String> map;

        RuleSetParameterFinderVisitor(Map<String, String> map) {
            this.map = map;
        }

        @Override
        public Void objectNode(ObjectNode node) {
            Map<StringNode, Node> members = node.getMembers();
            for (Map.Entry<StringNode, Node> entry : members.entrySet()) {
                String key = entry.getKey().getValue();
                Node param = entry.getValue();

                ParameterGenerator parameterGenerator = new ParameterGenerator(key, param);

                if (parameterGenerator.isBuiltIn()) {
                    Map.Entry<String, String> nameAndType = parameterGenerator.getNameAndType();
                    map.put(
                        nameAndType.getKey(),
                        nameAndType.getValue()
                    );
                }
            }
            return null;
        }

        @Override
        protected Void getDefault(Node node) {
            return null;
        }
    }
}
