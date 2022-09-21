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

import java.util.HashMap;
import java.util.Map;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.NodeVisitor;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.node.StringNode;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;


public class RuleSetParametersVisitor extends NodeVisitor.Default<Void> {
    private final TypeScriptWriter writer;
    private final Map<String, String> clientContextParams;

    public RuleSetParametersVisitor(TypeScriptWriter writer) {
        this.writer = writer;
        this.clientContextParams = new HashMap<>();
    }

    public RuleSetParametersVisitor(TypeScriptWriter writer, Map<String, String> clientContextParams) {
        this.writer = writer;
        this.clientContextParams = clientContextParams;
    }

    @Override
    public Void objectNode(ObjectNode node) {
        Map<StringNode, Node> members = node.getMembers();
        for (Map.Entry<StringNode, Node> entry : members.entrySet()) {
            String key = entry.getKey().getValue();
            Node param = entry.getValue();

            ParameterGenerator parameterGenerator = new ParameterGenerator(key, param);

            if (clientContextParams.isEmpty() || clientContextParams.containsKey(key)) {
                writer.write(parameterGenerator.toCodeString());
            }
        }
        return null;
    }

    @Override
    protected Void getDefault(Node node) {
        return null;
    }
}
