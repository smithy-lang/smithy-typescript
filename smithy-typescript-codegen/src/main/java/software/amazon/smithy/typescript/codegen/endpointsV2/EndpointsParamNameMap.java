/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.endpointsV2;

import java.util.HashMap;
import java.util.Map;

/**
 * Map of EndpointsV2 canonical ruleset param name to generated code param names.
 * This allows continuity for parameter names that were decided prior to EndpointsV2
 * and differ from their EndpointsV2 name.
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
            suggestedName = endpointsV2ParamName.substring(0, 1).toLowerCase() + endpointsV2ParamName.substring(1);
        }

        return MAPPING.getOrDefault(endpointsV2ParamName, suggestedName);
    }
}
