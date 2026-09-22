/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.util;

import java.util.stream.Collectors;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.utils.StringUtils;

/**
 * Serializes Smithy {@link Node} values to JavaScript object/array literals.
 */
@SmithyInternalApi
public final class JavaScriptObjectWriter {

    private JavaScriptObjectWriter() {}

    /**
     * Generic JSON -> JS serializer.
     */
    public static String serialize(Node node) {
        if (node.isObjectNode()) {
            ObjectNode obj = node.expectObjectNode();
            String members = obj.getMembers()
                .entrySet()
                .stream()
                .map(e -> "%s: %s".formatted(
                    StringUtils.escapeJavaString(e.getKey().getValue(), ""), serialize(e.getValue())))
                .collect(Collectors.joining(", "));
            return "{" + members + "}";
        }
        if (node.isArrayNode()) {
            String elements = node.expectArrayNode()
                .getElements()
                .stream()
                .map(JavaScriptObjectWriter::serialize)
                .collect(Collectors.joining(", "));
            return "[" + elements + "]";
        }
        if (node.isBooleanNode()) {
            return String.valueOf(node.expectBooleanNode().getValue());
        }
        if (node.isStringNode()) {
            String value = node.expectStringNode().getValue();
            // Escape via escapeJavaString; the previous backtick fallback left `${`
            // live for template interpolation and never escaped backslashes. See #2279.
            return StringUtils.escapeJavaString(value, "");
        }
        if (node.isNumberNode()) {
            return node.expectNumberNode().getValue().toString();
        }
        return node.toString();
    }

    /**
     * Serialize a Smithy Node to a JavaScript literal, with endpoint rules
     * engine conventions: objects with a "ref" member become {@code [1, "name"]},
     * objects with an "fn" member become {@code [0, "fn", [argv]]}.
     */
    public static String serializeEndpointNode(Node node) {
        if (node.isObjectNode()) {
            ObjectNode obj = node.expectObjectNode();
            if (obj.getMember("ref").isPresent()) {
                return "[1, %s]".formatted(
                    StringUtils.escapeJavaString(obj.expectStringMember("ref").getValue(), ""));
            }
            if (obj.getMember("fn").isPresent()) {
                String fn = obj.expectStringMember("fn").getValue();
                String argv = serializeEndpointNode(obj.expectArrayMember("argv"));
                return "[0, %s, %s]".formatted(StringUtils.escapeJavaString(fn, ""), argv);
            }
            String members = obj.getMembers()
                .entrySet()
                .stream()
                .map(e -> "%s: %s".formatted(
                    StringUtils.escapeJavaString(e.getKey().getValue(), ""), serializeEndpointNode(e.getValue())))
                .collect(Collectors.joining(", "));
            return "{" + members + "}";
        }
        if (node.isArrayNode()) {
            String elements = node.expectArrayNode()
                .getElements()
                .stream()
                .map(JavaScriptObjectWriter::serializeEndpointNode)
                .collect(Collectors.joining(", "));
            return "[" + elements + "]";
        }
        return serialize(node);
    }
}
