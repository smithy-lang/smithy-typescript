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

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * Manages a collection of endpoint parameter names to be omitted from a specific interface.
 */
public final class OmitEndpointParams {
    private static final Set<String> OMITTED_PARAMS = new HashSet<>();

    private OmitEndpointParams() {}
    
    public static void addOmittedParams(Set<String> paramNames) {
        OMITTED_PARAMS.addAll(paramNames);
    }

    public static boolean isOmitted(String paramName) {
        return OMITTED_PARAMS.contains(paramName);
    }

    public static Set<String> getOmittedParams() {
        return Collections.unmodifiableSet(OMITTED_PARAMS);
    }
}
