/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.endpointsV2;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Manages known client configuration keys that should not be placed in
 * clientContextParams.
 */
@SmithyInternalApi
public final class ClientConfigKeys {
    private static final Set<String> KNOWN_CONFIG_KEYS = ConcurrentHashMap.newKeySet();

    static {
        // Initialize with common client config keys
        KNOWN_CONFIG_KEYS.add("profile");
        KNOWN_CONFIG_KEYS.add("region");
        KNOWN_CONFIG_KEYS.add("credentials");
        KNOWN_CONFIG_KEYS.add("endpoint");
        KNOWN_CONFIG_KEYS.add("cacheMiddleware");
        KNOWN_CONFIG_KEYS.add("requestHandler");
        KNOWN_CONFIG_KEYS.add("retryStrategy");
        KNOWN_CONFIG_KEYS.add("retryMode");
        KNOWN_CONFIG_KEYS.add("maxAttempts");
        KNOWN_CONFIG_KEYS.add("logger");
        KNOWN_CONFIG_KEYS.add("signer");
        KNOWN_CONFIG_KEYS.add("useDualstackEndpoint");
        KNOWN_CONFIG_KEYS.add("useFipsEndpoint");
        KNOWN_CONFIG_KEYS.add("customUserAgent");
        KNOWN_CONFIG_KEYS.add("extensions");
        KNOWN_CONFIG_KEYS.add("tls");
        KNOWN_CONFIG_KEYS.add("disableHostPrefix");
        KNOWN_CONFIG_KEYS.add("signingRegion");
        KNOWN_CONFIG_KEYS.add("sigv4aSigningRegionSet");
        KNOWN_CONFIG_KEYS.add("authSchemePreference");
        KNOWN_CONFIG_KEYS.add("userAgentAppId");
        KNOWN_CONFIG_KEYS.add("protocol");
        KNOWN_CONFIG_KEYS.add("apiVersion");
        KNOWN_CONFIG_KEYS.add("serviceId");
        KNOWN_CONFIG_KEYS.add("runtime");
        KNOWN_CONFIG_KEYS.add("systemClockOffset");
        KNOWN_CONFIG_KEYS.add("signerConstructor");
        KNOWN_CONFIG_KEYS.add("endpointProvider");
        KNOWN_CONFIG_KEYS.add("urlParser");
        KNOWN_CONFIG_KEYS.add("base64Decoder");
        KNOWN_CONFIG_KEYS.add("base64Encoder");
        KNOWN_CONFIG_KEYS.add("defaultsMode");
        KNOWN_CONFIG_KEYS.add("bodyLengthChecker");
        KNOWN_CONFIG_KEYS.add("credentialDefaultProvider");
        KNOWN_CONFIG_KEYS.add("defaultUserAgentProvider");
        KNOWN_CONFIG_KEYS.add("eventStreamSerdeProvider");
        KNOWN_CONFIG_KEYS.add("getAwsChunkedEncodingStream");
        KNOWN_CONFIG_KEYS.add("md5");
        KNOWN_CONFIG_KEYS.add("sdkStreamMixin");
        KNOWN_CONFIG_KEYS.add("sha1");
        KNOWN_CONFIG_KEYS.add("sha256");
        KNOWN_CONFIG_KEYS.add("streamCollector");
        KNOWN_CONFIG_KEYS.add("streamHasher");
        KNOWN_CONFIG_KEYS.add("utf8Decoder");
        KNOWN_CONFIG_KEYS.add("utf8Encoder");
        KNOWN_CONFIG_KEYS.add("httpAuthSchemes");
        KNOWN_CONFIG_KEYS.add("httpAuthSchemeProvider");
        KNOWN_CONFIG_KEYS.add("serviceConfiguredEndpoint");
    }

    private ClientConfigKeys() {
        // Utility class
    }

    /**
     * Add a configuration key to the known set.
     *
     * @param key the configuration key to add
     */
    public static void addConfigKey(String key) {
        KNOWN_CONFIG_KEYS.add(key);
    }

    /**
     * Get custom context parameters by filtering out built-in and known config
     * keys.
     *
     * @param clientContextParams all client context parameters
     * @param builtInParams       built-in parameters
     * @return filtered custom context parameters
     */
    public static Map<String, String> getCustomContextParams(
            Map<String, String> clientContextParams,
            Map<String, String> builtInParams) {
        Map<String, String> customContextParams = new java.util.HashMap<>();
        for (Map.Entry<String, String> entry : clientContextParams.entrySet()) {
            if (!builtInParams.containsKey(entry.getKey())
                    && !KNOWN_CONFIG_KEYS.contains(entry.getKey())) {
                customContextParams.put(entry.getKey(), entry.getValue());
            }
        }
        return customContextParams;
    }
}
