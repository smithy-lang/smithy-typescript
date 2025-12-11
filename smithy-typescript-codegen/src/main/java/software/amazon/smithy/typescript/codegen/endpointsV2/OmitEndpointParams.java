/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.endpointsV2;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * Manages a collection of endpoint parameter names to be omitted from a specific interface. While
 * this could be extensible in the future, as of right now, this collection is maintaining endpoint
 * params to be omitted from the `ClientInputEndpointParameters` interface.
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
