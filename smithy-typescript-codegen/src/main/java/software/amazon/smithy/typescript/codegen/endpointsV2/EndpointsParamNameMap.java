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

/**
 * Map of EndpointsV2 canonical ruleset param name to generated code param names. This allows
 * continuity for parameter names that were decided prior to EndpointsV2 and differ from their
 * EndpointsV2 name.
 */
public final class EndpointsParamNameMap {
  private static final Map<String, String> MAPPING = new HashMap<>();

  private EndpointsParamNameMap() {}

  public static void setNameMapping(Map<String, String> parameterNameMap) {
    EndpointsParamNameMap.MAPPING.clear();
    MAPPING.putAll(parameterNameMap);
  }

  public static void addNameMapping(Map<String, String> parameterNameMap) {
    MAPPING.putAll(parameterNameMap);
  }

  public static String getLocalName(String endpointsV2ParamName) {
    boolean isTitleCase = false;
    if (endpointsV2ParamName.length() >= 2) {
      String char1 = endpointsV2ParamName.substring(0, 1);
      String char2 = endpointsV2ParamName.substring(1, 2);
      if (char1.toUpperCase().equals(char1) && char2.toLowerCase().equals(char2)) {
        isTitleCase = true;
      }
    }

    String suggestedName = endpointsV2ParamName;
    if (isTitleCase) {
      suggestedName =
          endpointsV2ParamName.substring(0, 1).toLowerCase() + endpointsV2ParamName.substring(1);
    }

    return MAPPING.getOrDefault(endpointsV2ParamName, suggestedName);
  }
}
