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

import java.util.Map;
import software.amazon.smithy.utils.MapUtils;


public final class EndpointsParamNameMap {
    /**
     * Map of EndpointsV2 ruleset param name to existing JSv3 config param names.
     */
    private static final Map<String, String> MAPPING = MapUtils.of(
        "Region", "region",
        "UseFIPS", "useFipsEndpoint",
        "UseDualStack", "useDualstackEndpoint",
        "ForcePathStyle", "forcePathStyle",
        "Accelerate", "useAccelerateEndpoint",
        "DisableMRAP", "disableMultiregionAccessPoints",
        "UseArnRegion", "useArnRegion"
    );

    private EndpointsParamNameMap() {}

    public static String getLocalName(String endpointsV2ParamName) {
        return MAPPING.getOrDefault(endpointsV2ParamName, endpointsV2ParamName);
    }
}
