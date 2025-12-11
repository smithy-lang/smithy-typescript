/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.documentation;

import java.util.Comparator;
import java.util.stream.Collectors;
import software.amazon.smithy.model.node.ArrayNode;
import software.amazon.smithy.model.node.BooleanNode;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.NullNode;
import software.amazon.smithy.model.node.NumberNode;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.node.StringNode;
import software.amazon.smithy.utils.SmithyInternalApi;

@SmithyInternalApi
public final class DocumentationExampleGenerator {
  private DocumentationExampleGenerator() {}

  /**
   * @return the ObjectNode from the curated example written as a JavaScript object literal.
   */
  public static String inputToJavaScriptObject(ObjectNode node) {
    if (node == null) {
      return "{ /* empty */ }";
    }
    return write(node, 0);
  }

  public static String outputToJavaScriptObject(ObjectNode node) {
    if (node == null) {
      return "{ /* metadata only */ }";
    }
    return write(node, 0);
  }

  private static String write(Node node, int indent) {
    StringBuilder buffer = new StringBuilder();
    String indentation = " ".repeat(indent);

    switch (node.getType()) {
      case OBJECT -> {
        ObjectNode objectNode = node.expectObjectNode();
        if (objectNode.getMembers().isEmpty()) {
          return indentation + "{ /* empty */ }";
        }
        String membersJoined =
            objectNode.getMembers().entrySet().stream()
                .sorted(Comparator.comparing(entry -> entry.getKey().getValue()))
                .map(
                    entry ->
                        indentation
                            + "  "
                            + entry.getKey().getValue()
                            + ": "
                            + write(entry.getValue(), indent + 2))
                .collect(Collectors.joining(",\n"));

        return buffer
            .append("{\n")
            .append(membersJoined)
            .append("\n")
            .append(indentation)
            .append("}")
            .toString();
      }
      case ARRAY -> {
        ArrayNode arrayNode = node.expectArrayNode();
        if (arrayNode.getElements().isEmpty()) {
          return indentation + "[]";
        }
        String membersJoined =
            arrayNode.getElements().stream()
                .map(elementNode -> indentation + "  " + write(elementNode, indent + 2))
                .collect(Collectors.joining(",\n"));

        return buffer
            .append("[\n")
            .append(membersJoined)
            .append("\n")
            .append(indentation)
            .append("]")
            .toString();
      }
      case STRING -> {
        StringNode stringNode = node.expectStringNode();
        if (stringNode.getValue().contains("\"")) {
          return "`" + stringNode.getValue() + "`";
        }
        return "\"" + stringNode.getValue() + "\"";
      }
      case NUMBER -> {
        NumberNode numberNode = node.expectNumberNode();
        return numberNode.getValue().toString();
      }
      case BOOLEAN -> {
        BooleanNode booleanNode = node.expectBooleanNode();
        return booleanNode.toString();
      }
      case NULL -> {
        NullNode nullNode = node.expectNullNode();
        return nullNode.toString();
      }
      default -> throw new IllegalStateException("Unexpected value: " + node.getType());
    }
  }
}
