/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.endpointsV2;

import java.util.HashMap;
import java.util.Map;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.NodeVisitor;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.node.StringNode;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;

/**
 * Writes endpoint ruleset params into a client-specific config resolver step, applying defaults as needed.
 */
public class RuleSetParametersVisitor extends NodeVisitor.Default<Void> {

    private final TypeScriptWriter writer;
    private final Map<String, String> clientContextParams;
    private boolean useLocalNames = false;
    private boolean writeDefaults = false;

    public RuleSetParametersVisitor(TypeScriptWriter writer) {
        this.writer = writer;
        this.clientContextParams = new HashMap<>();
    }

    public RuleSetParametersVisitor(
        TypeScriptWriter writer,
        Map<String, String> clientContextParams,
        boolean useLocalNames
    ) {
        this.writer = writer;
        this.clientContextParams = clientContextParams;
        this.useLocalNames = useLocalNames;
    }

    public RuleSetParametersVisitor(TypeScriptWriter writer, boolean writeDefaults) {
        this(writer);
        this.writeDefaults = writeDefaults;
        this.useLocalNames = true;
    }

    @Override
    public Void objectNode(ObjectNode node) {
        Map<StringNode, Node> members = node.getMembers();
        for (Map.Entry<StringNode, Node> entry : members.entrySet()) {
            String key = entry.getKey().getValue();
            String localKey = key;
            Node param = entry.getValue();
            if (useLocalNames) {
                localKey = EndpointsParamNameMap.getLocalName(key);
            }

            ParameterGenerator parameterGenerator = new ParameterGenerator(localKey, param, useLocalNames);

            if (localKey.equals("endpoint")) {
                writer.addTypeImport("Endpoint", null, TypeScriptDependency.SMITHY_TYPES);
                writer.addTypeImport("EndpointV2", null, TypeScriptDependency.SMITHY_TYPES);
                writer.addTypeImport("Provider", null, TypeScriptDependency.SMITHY_TYPES);
            }

            if (writeDefaults) {
                if (parameterGenerator.hasDefault()) {
                    writer.write(parameterGenerator.defaultAsCodeString());
                }
            } else if (clientContextParams.isEmpty() || clientContextParams.containsKey(key)) {
                boolean isClientContextParams = !clientContextParams.isEmpty();
                writer.write(parameterGenerator.toCodeString(isClientContextParams));
            }
        }
        return null;
    }

    @Override
    protected Void getDefault(Node node) {
        return null;
    }
}
