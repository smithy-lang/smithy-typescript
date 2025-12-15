/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.endpointsV2;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Queue;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import software.amazon.smithy.model.node.ArrayNode;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.NodeVisitor;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.node.StringNode;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeType;
import software.amazon.smithy.rulesengine.language.Endpoint;
import software.amazon.smithy.rulesengine.language.EndpointRuleSet;
import software.amazon.smithy.rulesengine.language.syntax.expressions.Expression;
import software.amazon.smithy.rulesengine.language.syntax.rule.Condition;
import software.amazon.smithy.rulesengine.language.syntax.rule.EndpointRule;
import software.amazon.smithy.rulesengine.language.syntax.rule.ErrorRule;
import software.amazon.smithy.rulesengine.language.syntax.rule.Rule;
import software.amazon.smithy.rulesengine.language.syntax.rule.TreeRule;
import software.amazon.smithy.rulesengine.traits.ClientContextParamsTrait;
import software.amazon.smithy.rulesengine.traits.ContextParamTrait;
import software.amazon.smithy.rulesengine.traits.EndpointRuleSetTrait;
import software.amazon.smithy.rulesengine.traits.OperationContextParamsTrait;
import software.amazon.smithy.rulesengine.traits.StaticContextParamsTrait;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.SmithyInternalApi;

@SmithyInternalApi
public class RuleSetParameterFinder {

    public static final Pattern URL_PARAMETERS = Pattern.compile("\\{(\\w+)[}#]");

    private final ServiceShape service;
    private final EndpointRuleSetTrait ruleset;

    public RuleSetParameterFinder(ServiceShape service) {
        this.service = service;
        this.ruleset = service
            .getTrait(EndpointRuleSetTrait.class)
            .orElseThrow(() -> new RuntimeException("Service does not have EndpointRuleSetTrait."));
    }

    /**
     * It's possible for a parameter to pass validation, i.e. exist in the modeled shapes
     * and be used in endpoint tests, but have no actual effect on endpoint resolution.
     *
     * @return the list of endpoint parameters that are actually used in endpoint resolution.
     */
    public List<String> getEffectiveParams() {
        Set<String> effectiveParams = new TreeSet<>();
        EndpointRuleSet endpointRuleSet = ruleset.getEndpointRuleSet();
        Set<String> initialParams = new HashSet<>();

        endpointRuleSet
            .getParameters()
            .forEach(parameter -> {
                initialParams.add(parameter.getName().getName().getValue());
            });

        Queue<Rule> ruleQueue = new ArrayDeque<>(endpointRuleSet.getRules());
        Queue<Condition> conditionQueue = new ArrayDeque<>();
        Queue<Node> argQueue = new ArrayDeque<>();

        while (!ruleQueue.isEmpty() || !conditionQueue.isEmpty() || !argQueue.isEmpty()) {
            while (!argQueue.isEmpty()) {
                Node arg = argQueue.poll();
                if (arg.isObjectNode()) {
                    Optional<Node> ref = arg.expectObjectNode().getMember("ref");
                    if (ref.isPresent()) {
                        String refName = ref.get().expectStringNode().getValue();
                        if (initialParams.contains(refName)) {
                            effectiveParams.add(refName);
                        }
                    }
                    Optional<Node> argv = arg.expectObjectNode().getMember("argv");
                    if (argv.isPresent()) {
                        ArrayNode nestedArgv = argv.get().expectArrayNode();
                        for (Node nestedArg : nestedArgv) {
                            if (nestedArg.isObjectNode()) {
                                argQueue.add(nestedArg.expectObjectNode());
                            }
                        }
                    }
                } else if (arg.isStringNode()) {
                    String argString = arg.expectStringNode().getValue();
                    URL_PARAMETERS.matcher(argString)
                        .results()
                        .forEach(matchResult -> {
                            if (matchResult.groupCount() >= 1) {
                                if (initialParams.contains(matchResult.group(1))) {
                                    effectiveParams.add(matchResult.group(1));
                                }
                            }
                        });
                }
            }

            while (!conditionQueue.isEmpty()) {
                Condition condition = conditionQueue.poll();
                ArrayNode argv = condition.toNode().expectObjectNode().expectArrayMember("argv");
                for (Node arg : argv) {
                    argQueue.add(arg);
                }
            }

            Rule rule = ruleQueue.poll();
            if (null == rule) {
                continue;
            }
            List<Condition> conditions = rule.getConditions();
            conditionQueue.addAll(conditions);
            if (rule instanceof TreeRule treeRule) {
                ruleQueue.addAll(treeRule.getRules());
            } else if (rule instanceof EndpointRule endpointRule) {
                Endpoint endpoint = endpointRule.getEndpoint();
                Expression url = endpoint.getUrl();
                String urlString = url.toString();

                URL_PARAMETERS.matcher(urlString)
                    .results()
                    .forEach(matchResult -> {
                        if (matchResult.groupCount() >= 1) {
                            if (initialParams.contains(matchResult.group(1))) {
                                effectiveParams.add(matchResult.group(1));
                            }
                        }
                    });
            } else if (rule instanceof ErrorRule errorRule) {
                // no additional use of endpoint parameters in error rules.
            }
        }

        return new ArrayList<>(effectiveParams);
    }

    /**
     * TODO(endpointsv2) From definitions in EndpointRuleSet.parameters, or
     * TODO(endpointsv2) are they from the closed set?
     */
    public Map<String, String> getBuiltInParams() {
        Map<String, String> map = new HashMap<>();
        ObjectNode ruleSet = ruleset.getRuleSet().expectObjectNode();
        ruleSet
            .getObjectMember("parameters")
            .ifPresent(parameters -> {
                parameters.accept(new RuleSetParameterFinderVisitor(map));
            });
        return map;
    }

    /**
     * Check if there are custom client context parameters.
     */
    public boolean hasCustomClientContextParams() {
        Map<String, String> clientContextParams = getClientContextParams();
        Map<String, String> builtInParams = getBuiltInParams();
        builtInParams.keySet().removeIf(OmitEndpointParams::isOmitted);
        Map<String, String> customContextParams = ClientConfigKeys.getCustomContextParams(
            clientContextParams,
            builtInParams
        );
        return !customContextParams.isEmpty();
    }

    /**
     * Write custom client context parameters to TypeScript writer.
     */
    public void writeInputConfigCustomClientContextParams(TypeScriptWriter writer) {
        Map<String, String> clientContextParams = getClientContextParams();
        Map<String, String> builtInParams = getBuiltInParams();
        builtInParams.keySet().removeIf(OmitEndpointParams::isOmitted);
        Map<String, String> customContextParams = ClientConfigKeys.getCustomContextParams(
            clientContextParams,
            builtInParams
        );
        ObjectNode ruleSet = ruleset.getRuleSet().expectObjectNode();
        ruleSet.getObjectMember("parameters").ifPresent(parameters -> {
            parameters.accept(new RuleSetParametersVisitor(writer, customContextParams, true));
        });
    }

    /**
     * Write nested client context parameter defaults to TypeScript writer.
     * Only includes conflicting parameters with default values.
     */
    public void writeNestedClientContextParamDefaults(TypeScriptWriter writer) {
        Map<String, String> clientContextParams = getClientContextParams();
        Map<String, String> builtInParams = getBuiltInParams();
        builtInParams.keySet().removeIf(OmitEndpointParams::isOmitted);
        ObjectNode ruleSet = ruleset.getRuleSet().expectObjectNode();
        if (ruleSet.getObjectMember("parameters").isPresent()) {
            ObjectNode parameters = ruleSet.getObjectMember("parameters").get().expectObjectNode();
            writer.write("");
            writer.writeDocs("@internal");
            writer.openBlock("const clientContextParamDefaults = {", "} as const;", () -> {
                // Write defaults only for conflicting parameters
                for (Map.Entry<String, String> entry : clientContextParams.entrySet()) {
                    String paramName = entry.getKey();
                    // Check if this is a conflicting parameter (exists in both clientContextParams and knownConfigKeys)
                    if (ClientConfigKeys.isKnownConfigKey(paramName) && !builtInParams.containsKey(paramName)) {
                        ObjectNode paramNode = parameters.getObjectMember(paramName).orElse(null);
                        if (paramNode != null && paramNode.containsMember("default")) {
                            software.amazon.smithy.model.node.Node defaultValue = paramNode.getMember("default").get();
                            if (defaultValue.isStringNode()) {
                                writer.write("$L: \"$L\",", paramName, defaultValue.expectStringNode().getValue());
                            } else if (defaultValue.isBooleanNode()) {
                                writer.write("$L: $L,", paramName, defaultValue.expectBooleanNode().getValue());
                            }
                        }
                    }
                }
            });
        }
    }

    /**
     * Write config resolver nested client context parameters to TypeScript writer.
     */
    public void writeConfigResolverNestedClientContextParams(TypeScriptWriter writer) {
        Map<String, String> clientContextParams = getClientContextParams();
        Map<String, String> builtInParams = getBuiltInParams();
        builtInParams.keySet().removeIf(OmitEndpointParams::isOmitted);
        Map<String, String> customContextParams = ClientConfigKeys.getCustomContextParams(
            clientContextParams,
            builtInParams
        );
        ObjectNode ruleSet = ruleset.getRuleSet().expectObjectNode();
        boolean hasDefaultsForResolve = false;
        if (ruleSet.getObjectMember("parameters").isPresent()) {
            ObjectNode parameters = ruleSet.getObjectMember("parameters").get().expectObjectNode();
            hasDefaultsForResolve = customContextParams.entrySet()
                .stream()
                .anyMatch(entry -> {
                    ObjectNode paramNode = parameters.getObjectMember(entry.getKey()).orElse(null);
                    return paramNode != null && paramNode.containsMember("default");
                });
        }
        if (hasDefaultsForResolve) {
            writer.write(
                "clientContextParams: Object.assign(clientContextParamDefaults, "
                    + "options.clientContextParams),"
            );
        } else {
            writer.write(
                "clientContextParams: options.clientContextParams ?? {},"
            );
        }
    }

    /**
     * Defined on the service shape as smithy.rules#clientContextParams traits.
     */
    public Map<String, String> getClientContextParams() {
        Map<String, String> map = new HashMap<>();
        Optional<ClientContextParamsTrait> trait = service.getTrait(ClientContextParamsTrait.class);
        if (trait.isPresent()) {
            ClientContextParamsTrait clientContextParamsTrait = trait.get();
            clientContextParamsTrait
                .getParameters()
                .forEach((name, definition) -> {
                    ShapeType shapeType = definition.getType();
                    if (shapeType.isShapeType(ShapeType.STRING) || shapeType.isShapeType(ShapeType.BOOLEAN)) {
                        map.put(
                            name,
                            // "boolean" and "string" are directly usable in TS.
                            definition.getType().toString().toLowerCase()
                        );
                    } else if (shapeType.isShapeType(ShapeType.LIST)) {
                        map.put(
                            name,
                            "string[]" // Only string lists are supported.
                        );
                    } else {
                        throw new RuntimeException(
                            "unexpected type " + definition.getType().toString()
                                + " received as clientContextParam."
                        );
                    }
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
            staticContextParamsTrait
                .getParameters()
                .forEach((name, definition) -> {
                    String value;
                    if (definition.getValue().isStringNode()) {
                        value = "`" + definition.getValue().expectStringNode().toString() + "`";
                    } else if (definition.getValue().isBooleanNode()) {
                        value = definition.getValue().expectBooleanNode().toString();
                    } else if (definition.getValue().isArrayNode()) {
                        ArrayNode arrayNode = definition.getValue().expectArrayNode();
                        value = arrayNode
                            .getElements()
                            .stream()
                            .map(element -> element.expectStringNode().getValue())
                            .collect(Collectors.joining("`, `", "[`", "`]"));
                    } else {
                        throw new RuntimeException(
                            "unexpected type " +
                                definition.getValue().getType().toString() +
                                " received as staticContextParam."
                        );
                    }
                    map.put(name, value);
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
            operationInput
                .getAllMembers()
                .forEach((String memberName, MemberShape member) -> {
                    Optional<ContextParamTrait> trait = member.getTrait(ContextParamTrait.class);
                    if (trait.isPresent()) {
                        ContextParamTrait contextParamTrait = trait.get();
                        String name = contextParamTrait.getName();
                        map.put(name, member.getMemberName());
                    }
                });
        }

        return map;
    }

    /**
     * Get map of params to JavaScript equivalent of provided JMESPath expressions.
     */
    public Map<String, String> getOperationContextParamValues(OperationShape operation) {
        Map<String, String> map = new HashMap<>();

        Optional<OperationContextParamsTrait> trait = operation.getTrait(OperationContextParamsTrait.class);
        if (trait.isPresent()) {
            trait
                .get()
                .getParameters()
                .forEach((name, definition) -> {
                    String separator = "?.";
                    String value = "input";
                    String path = definition.getPath();
                    value = getJmesPathExpression(separator, value, path);

                    // Remove no-op map, if it exists.
                    final String noOpMap = "map((obj: any) => obj";
                    if (value.endsWith(separator + noOpMap)) {
                        value = value.substring(0, value.length() - noOpMap.length() - separator.length());
                    }

                    // Close all open brackets.
                    value += ")".repeat(
                        (int) (value
                            .chars()
                            .filter(ch -> ch == '(')
                            .count() -
                            value
                                .chars()
                                .filter(ch -> ch == ')')
                                .count())
                    );

                    map.put(name, value);
                });
        }

        return map;
    }

    String getJmesPathExpression(String separator, String value, String path) {
        // Split JMESPath expression string on separator and add JavaScript equivalent.
        while (path.length() > 0) {
            if (path.startsWith("[") && !path.startsWith("[*]")) {
                // Process MultiSelect List https://jmespath.org/specification.html#multiselect-list
                if (value.endsWith("obj")) {
                    value = value.substring(0, value.length() - 3);
                }

                value += "[";
                path = path.substring(1);

                while (true) {
                    int commaIndex = path.indexOf(",");
                    int sepIndex = (commaIndex == -1) ? path.indexOf("]") : commaIndex;
                    String part = path.substring(0, sepIndex);
                    path = path.substring(sepIndex + 1).trim();
                    value += getJmesPathExpression(separator, "obj", part) + ",";
                    if (commaIndex == -1) {
                        // Remove trailing comma and close bracket.
                        value = value.substring(0, value.length() - 1) + "].filter((i) => i))";
                        break;
                    }
                }

                // Process Flatten operator https://jmespath.org/specification.html#flatten-operator
                if (path.startsWith("[]")) {
                    value += ".flat()";
                    path = path.substring(2);
                }
                continue;
            }

            int dotIndex = path.indexOf(".");
            String part = dotIndex == -1 ? path : path.substring(0, dotIndex);
            path = dotIndex == -1 ? "" : path.substring(dotIndex + 1);
            value = getJmesPathExpressionSection(separator, value, part);
        }
        return value;
    }

    private String getJmesPathExpressionSection(String separator, String value, String part) {
        if (value.endsWith(")")) {
            // The value is an object, which needs to run on map.
            value += ".map((obj: any) => obj";
        }

        // Process keys https://jmespath.org/specification.html#keys
        if (part.startsWith("keys(")) {
            // Get provided object for which keys are to be extracted.
            String object = part.substring(5, part.length() - 1);
            value = "Object.keys(" + value + separator + object + " ?? {})";
            return value;
        }

        // Process list wildcard expression https://jmespath.org/specification.html#wildcard-expressions
        if (part.equals("*") || part.equals("[*]")) {
            value = "Object.values(" + value + " ?? {})";
            return value;
        }

        // Process hash wildcard expression https://jmespath.org/specification.html#wildcard-expressions
        if (part.endsWith("[*]")) {
            // Get key to run hash wildcard on.
            String key = part.substring(0, part.length() - 3);
            value = value + separator + key + separator + "map((obj: any) => obj";
            return value;
        }

        // Process Flatten operator https://jmespath.org/specification.html#flatten-operator
        if (part.endsWith("[]")) {
            // Get key to run hash wildcard on.
            String key = part.substring(0, part.length() - 2);

            // If key is on list item
            if (key.endsWith("[*]")) {
                value = value + separator + key.substring(0, key.length() - 3) + ".flat()";
            } else {
                // key is on object
                value = value + separator + key + ").flat()";
            }
            return value;
        }

        // Treat remaining part as identifier without spaces https://jmespath.org/specification.html#identifiers
        value += separator + part;
        return value;
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
                    map.put(nameAndType.getKey(), nameAndType.getValue());
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
