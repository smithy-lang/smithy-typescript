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

import java.util.AbstractMap;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import software.amazon.smithy.model.node.BooleanNode;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.node.StringNode;

/** Owner for a parameter object node in the EndpointRuleSet. */
public class ParameterGenerator {
  private final String parameterName;
  private final Node param;
  private boolean required = false;
  private boolean isInputKey;
  private String tsParamType = "string";

  /**
   * @param key - the param name.
   * @param param - the param value.
   * @param isInputKey - whether the key is a client input key. This is distinct from canonical
   *     endpoint param name because it has been transformed to match pre-existing keys in published
   *     clients.
   */
  public ParameterGenerator(String key, Node param, boolean isInputKey) {
    parameterName = key;
    this.param = param;
    this.isInputKey = isInputKey;

    ObjectNode paramNode =
        param
            .asObjectNode()
            .orElseThrow(() -> new RuntimeException("param node is not object node."));

    Optional<BooleanNode> requiredNode = paramNode.getBooleanMember("required");
    requiredNode.ifPresent(booleanNode -> required = booleanNode.getValue());

    Optional<StringNode> type = paramNode.getStringMember("type");

    if (type.isPresent()) {
      switch (type.get().getValue()) {
        case "String":
        case "string":
          tsParamType = "string";
          break;
        case "Boolean":
        case "boolean":
          tsParamType = "boolean";
          break;
        case "stringArray":
          tsParamType = "string[]";
          break;
        default:
          // required by linter
      }
    }
  }

  public ParameterGenerator(String key, Node param) {
    this(key, param, false);
  }

  public boolean isBuiltIn() {
    return param.expectObjectNode().containsMember("builtIn");
  }

  public boolean hasDefault() {
    return param.expectObjectNode().containsMember("default");
  }

  public String defaultAsCodeString() {
    if (!hasDefault()) {
      return "";
    }
    String buffer = "";
    buffer += parameterName;
    buffer += ": ";
    buffer += "options." + parameterName + " ?? ";
    ObjectNode paramNode = param.expectObjectNode();
    StringNode type = paramNode.expectStringMember("type");

    switch (type.getValue()) {
      case "String":
      case "string":
        buffer += "\"" + paramNode.expectStringMember("default").getValue() + "\"";
        break;
      case "Boolean":
      case "boolean":
        buffer += paramNode.expectBooleanMember("default").getValue() ? "true" : "false";
        break;
      case "stringArray":
        buffer +=
            paramNode.expectArrayMember("default").getElements().stream()
                .map(element -> element.expectStringNode().getValue())
                .collect(Collectors.joining("`, `", "[`", "`]"));
        break;
      default:
        throw new RuntimeException("Unhandled endpoint param type: " + type.getValue());
    }

    buffer += ",";
    return buffer;
  }

  public Map.Entry<String, String> getNameAndType() {
    return new AbstractMap.SimpleEntry<>(parameterName, tsParamType);
  }

  /** Used to generate interface line for EndpointParameters.ts. */
  public String toCodeString(boolean isClientContextParam) {
    String buffer = "";
    buffer += parameterName;
    boolean optional = !required || hasDefault() || isClientContextParam;
    if (optional) {
      buffer += "?";
    }
    buffer += ": ";

    if (parameterName.equals("endpoint") && isInputKey) {
      buffer +=
          "string | Provider<string> | Endpoint | Provider<Endpoint> | EndpointV2 |"
              + " Provider<EndpointV2>;";
    } else {
      if (optional) {
        if (isClientContextParam) {
          buffer +=
              (tsParamType + " | undefined | Provider<" + tsParamType + " | undefined>") + ";";
        } else {
          buffer += tsParamType + " | undefined;";
        }
      } else {
        buffer += tsParamType + ";";
      }
    }
    return buffer;
  }
}
