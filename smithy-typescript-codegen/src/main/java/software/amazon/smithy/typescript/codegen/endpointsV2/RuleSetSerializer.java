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

import software.amazon.smithy.model.node.ArrayNode;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.util.PropertyAccessor;

public class RuleSetSerializer {
    private final Node ruleSet;
    private final TypeScriptWriter writer;

    public RuleSetSerializer(Node ruleSet, TypeScriptWriter writer) {
        this.ruleSet = ruleSet;
        this.writer = writer;
    }

    /**
     * Write the ruleset as a TS object.
     */
    public void generate() {
        ObjectNode objectNode = ruleSet.expectObjectNode();
        writer.openCollapsibleBlock(
            "{",
            "};",
            !objectNode.getMembers().isEmpty(),
            () -> {
                objectNode.getMembers().forEach((k, v) -> {
                    writer.writeInline(PropertyAccessor.inlineKey(k.toString()) + ": ");
                    traverse(v);
                });
            }
        );
    }

    private void traverse(Node node) {
        if (node.isObjectNode()) {
            ObjectNode objectNode = node.expectObjectNode();

            writer.openCollapsibleBlock(
                "{",
                "},",
                !objectNode.getMembers().isEmpty(),
                () -> {
                    objectNode.getMembers().forEach((k, v) -> {
                        writer.writeInline(PropertyAccessor.inlineKey(k.toString()) + ": ");
                        traverse(v);
                    });
                }
            );
        } else if (node.isArrayNode()) {
            ArrayNode arrayNode = node.expectArrayNode();
            writer.openCollapsibleBlock(
                "[",
                "],",
                !arrayNode.getElements().isEmpty(),
                () -> {
                    arrayNode.getElements().forEach(this::traverse);
                }
            );
        } else if (node.isBooleanNode()) {
            writer.write("$L,", node.expectBooleanNode().getValue());
        } else if (node.isNumberNode()) {
            Number number = node.expectNumberNode().getValue();

            float floatValue = number.floatValue();
            int intValue = number.intValue();

            if (floatValue == Math.floor(floatValue)) {
                writer.write("$L,", intValue);
            } else {
                writer.write("$L,", floatValue);
            }
        } else if (node.isStringNode()) {
            String stringValue = node.expectStringNode().getValue();
            if (stringValue.contains("\"")) {
                writer.write(
                    "`$L`,",
                    stringValue
                        .replaceAll("`", "\\\\`")
                );
            } else {
                writer.write(
                    "\"$L\",",
                    stringValue
                );
            }
        }
    }
}
