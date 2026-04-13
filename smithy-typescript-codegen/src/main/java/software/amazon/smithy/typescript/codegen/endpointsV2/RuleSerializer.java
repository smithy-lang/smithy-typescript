/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.endpointsV2;

import java.util.List;
import software.amazon.smithy.model.node.ArrayNode;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.NumberNode;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.rulesengine.language.syntax.rule.Condition;
import software.amazon.smithy.rulesengine.language.syntax.rule.EndpointRule;
import software.amazon.smithy.rulesengine.language.syntax.rule.ErrorRule;
import software.amazon.smithy.rulesengine.language.syntax.rule.NoMatchRule;
import software.amazon.smithy.rulesengine.language.syntax.rule.Rule;
import software.amazon.smithy.rulesengine.language.syntax.rule.TreeRule;
import software.amazon.smithy.utils.SmithyInternalApi;

@SmithyInternalApi
public class RuleSerializer {
    /**
     * Note: the rules will not contain conditions, nor TreeRules.
     */
    private final Rule rule;

    public RuleSerializer(Rule rule) {
        this.rule = rule;

        List<Condition> conditions = rule.getConditions();
        if (conditions != null && !conditions.isEmpty()) {
            throw new IllegalArgumentException("Endpoint rules for BDD must not contain conditions.");
        }
    }

    public ArrayNode toArrayNode() {
        ArrayNode array = ArrayNode.fromNodes();
        if (rule instanceof EndpointRule endpointRule) {
            ObjectNode epNode = endpointRule.getEndpoint().toNode().expectObjectNode();

            Node url = epNode.expectMember("url");
            ObjectNode propertiesNode = epNode.expectObjectMember("properties");
            ObjectNode headersNode = epNode.expectObjectMember("headers");

            array = headersNode.isEmpty() ? array
                .withValue(url)
                .withValue(propertiesNode)
                : array
                    .withValue(url)
                    .withValue(propertiesNode)
                    .withValue(headersNode);
        } else if (rule instanceof ErrorRule errorRule) {
            array = array
                .withValue(NumberNode.from(-1))
                .withValue(errorRule.getError().toNode());
        } else if (rule instanceof NoMatchRule) {
            array = array.withValue(NumberNode.from(-1));
        } else if (rule instanceof TreeRule) {
            throw new IllegalArgumentException("BDD should not have TreeRule objects.");
        } else {
            throw new IllegalArgumentException("Unrecognized rule type: " + rule.getClass().getName());
        }

        return array;
    }
}
