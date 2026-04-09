/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.endpointsV2;

import java.util.Optional;
import software.amazon.smithy.model.node.ArrayNode;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.node.StringNode;
import software.amazon.smithy.rulesengine.language.syntax.rule.Condition;
import software.amazon.smithy.utils.SmithyInternalApi;

@SmithyInternalApi
public class ConditionSerializer {
    private final Condition condition;

    public ConditionSerializer(Condition condition) {
        this.condition = condition;
    }

    public ArrayNode toArrayNode() {
        ObjectNode node = condition.toNode().expectObjectNode();

        StringNode fn = node.expectStringMember("fn");
        ArrayNode argv = node.expectArrayMember("argv");
        Optional<StringNode> assign = node.getStringMember("assign");

        return assign.map(stringNode -> ArrayNode.fromNodes(fn, argv, stringNode))
            .orElse(ArrayNode.fromNodes(fn, argv));
    }
}
