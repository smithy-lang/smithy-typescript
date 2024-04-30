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