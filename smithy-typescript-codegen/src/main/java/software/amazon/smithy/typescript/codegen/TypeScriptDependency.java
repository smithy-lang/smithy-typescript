/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.logging.Logger;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * An enum of all of the built-in dependencies managed by this package.
 */
@SmithyUnstableApi
public enum TypeScriptDependency implements Dependency {
    SMITHY_CORE("dependencies", "@smithy/core", false),
    AWS_SDK_CLIENT_DOCGEN("devDependencies", "@smithy/service-client-documentation-generator", false),
    @Deprecated
    AWS_SDK_TYPES("dependencies", "@aws-sdk/types", false),
    SMITHY_TYPES("dependencies", "@smithy/types", true),
    AWS_SMITHY_CLIENT("dependencies", "@smithy/smithy-client", true),
    INVALID_DEPENDENCY("dependencies", "@smithy/invalid-dependency", true),
    CONFIG_RESOLVER("dependencies", "@smithy/config-resolver", true),
    TYPES_NODE("devDependencies", "@types/node", "^20.14.8", true),

    MIDDLEWARE_CONTENT_LENGTH("dependencies", "@smithy/middleware-content-length", true),
    MIDDLEWARE_RETRY("dependencies", "@smithy/middleware-retry", true),
    UTIL_RETRY("dependencies", "@smithy/util-retry", false),
    MIDDLEWARE_STACK("dependencies", "@smithy/middleware-stack", true),
    MIDDLEWARE_ENDPOINTS_V2("dependencies", "@smithy/middleware-endpoint", false),
    @Deprecated
    AWS_SDK_UTIL_ENDPOINTS("dependencies", "@aws-sdk/util-endpoints", false),
    UTIL_ENDPOINTS("dependencies", "@smithy/util-endpoints", false),

    AWS_CRYPTO_SHA256_BROWSER("dependencies", "@aws-crypto/sha256-browser", "5.2.0", true),
    AWS_CRYPTO_SHA256_JS("dependencies", "@aws-crypto/sha256-js", "5.2.0", true),

    AWS_SDK_URL_PARSER("dependencies", "@smithy/url-parser", true),

    AWS_SDK_UTIL_WAITERS("dependencies", "@smithy/util-waiter", false),

    AWS_SDK_UTIL_DEFAULTS_MODE_NODE("dependencies", "@smithy/util-defaults-mode-node", true),
    AWS_SDK_UTIL_DEFAULTS_MODE_BROWSER("dependencies", "@smithy/util-defaults-mode-browser", true),

    NODE_CONFIG_PROVIDER("dependencies", "@smithy/node-config-provider", false),

    @Deprecated
    UUID_TYPES("dependencies", "@types/uuid", "^9.0.1", false),
    @Deprecated
    UUID("dependencies", "uuid", "^9.0.1", false),

    // Conditionally added when httpChecksumRequired trait exists
    BODY_CHECKSUM("dependencies", "@smithy/middleware-apply-body-checksum", false),

    // Conditionally added when using an HTTP application protocol.
    PROTOCOL_HTTP("dependencies", "@smithy/protocol-http", false),
    AWS_SDK_FETCH_HTTP_HANDLER("dependencies", "@smithy/fetch-http-handler", false),
    AWS_SDK_NODE_HTTP_HANDLER("dependencies", "@smithy/node-http-handler", false),

    // Conditionally added when setting the auth middleware.
    UTIL_MIDDLEWARE("dependencies", "@smithy/util-middleware", false),
    @Deprecated
    AWS_SDK_UTIL_MIDDLEWARE("dependencies", "@smithy/util-middleware", false),

    // Conditionally added if a event stream shape is found anywhere in the model
    AWS_SDK_EVENTSTREAM_SERDE_CONFIG_RESOLVER("dependencies", "@smithy/eventstream-serde-config-resolver", false),
    AWS_SDK_EVENTSTREAM_SERDE_NODE("dependencies", "@smithy/eventstream-serde-node", false),
    AWS_SDK_EVENTSTREAM_SERDE_BROWSER("dependencies", "@smithy/eventstream-serde-browser", false),
    AWS_SDK_EVENTSTREAM_CODEC("dependencies", "@smithy/eventstream-codec", false),

    // Conditionally added if a requestCompression shape is found on any model operation.
    MIDDLEWARE_COMPRESSION("dependencies", "@smithy/middleware-compression", false),

    // Conditionally added if a big decimal shape is found in a model.
    BIG_JS("dependencies", "big.js", "^6.0.0", false),
    TYPES_BIG_JS("devDependencies", "@types/big.js", "^6.0.0", false),

    // Conditionally added when interacting with specific protocol test bodyMediaType values.
    AWS_SDK_QUERYSTRING_BUILDER("dependencies", "@smithy/querystring-builder", false),

    // Conditionally added when XML parser needs to be used.
    XML_PARSER("dependencies", "fast-xml-parser", "5.7.1", false),
    HTML_ENTITIES("dependencies", "entities", "2.2.0", false),

    // Conditionally added when streaming blob response payload exists.

    // Conditionally added when @aws.auth#sigv4 is used
    SIGNATURE_V4("dependencies", "@smithy/signature-v4", false),

    // This package should never have a major version, and should only use minor and patch versions in development.
    // Exports are located between @smithy/types and @smithy/core
    @Deprecated
    EXPERIMENTAL_IDENTITY_AND_AUTH("dependencies", "@smithy/experimental-identity-and-auth", false),

    // Conditionally added when specs have been generated.
    VITEST("devDependencies", "vitest", "^4.0.17", false),

    // Conditionally added when `generateTypeDoc` is true.
    TYPEDOC("devDependencies", "typedoc", "0.23.23", false),

    // Server dependency for SSDKs
    SERVER_COMMON("dependencies", "@aws-smithy/server-common", false),

    // for snapshot testing.
    SNAPSHOTS("devDependencies", "@smithy/snapshot-testing", false);

    public static final String NORMAL_DEPENDENCY = "dependencies";
    public static final String DEV_DEPENDENCY = "devDependencies";
    public static final String PEER_DEPENDENCY = "peerDependencies";
    public static final String BUNDLED_DEPENDENCY = "bundledDependencies";
    public static final String OPTIONAL_DEPENDENCY = "optionalDependencies";

    public final String packageName;
    public final String version;
    public final SymbolDependency dependency;

    TypeScriptDependency(String type, String name, boolean unconditional) {
        String version;
        if (name.startsWith("@aws-sdk/")) {
            version = SdkVersion.getVersion(name);
        } else {
            version = DependencyVersion.getVersion(name);
        }

        if (version == null) {
            version = "latest";
        }

        if (name.startsWith("@smithy/") || name.startsWith("@aws-sdk/")) {
            if (!version.startsWith("^") && version.matches("^\\d+\\.\\d+\\.\\d+$")) {
                version = "^" + version;
            }
        }

        this.dependency = SymbolDependency.builder()
            .dependencyType(type)
            .packageName(name)
            .version(version)
            .putProperty("unconditional", unconditional)
            .build();
        this.packageName = name;
        this.version = version;
    }

    TypeScriptDependency(String type, String name, String version, boolean unconditional) {
        this.dependency = SymbolDependency.builder()
            .dependencyType(type)
            .packageName(name)
            .version(version)
            .putProperty("unconditional", unconditional)
            .build();
        this.packageName = name;
        this.version = version;
    }

    /**
     * Get all dependencies that are always added to the generated
     * package.json file.
     *
     * @return Returns all of the unconditional dependencies.
     */
    public static List<SymbolDependency> getUnconditionalDependencies() {
        List<SymbolDependency> resolved = new ArrayList<>();

        for (TypeScriptDependency dependency : TypeScriptDependency.values()) {
            if (dependency.isUnconditional()) {
                resolved.add(dependency.dependency);
            }
        }

        return resolved;
    }

    /**
     * @return the smithy core version, used in @smithy/core versioning scheme.
     */
    public static String getSmithyCoreVersion() {
        return DependencyVersion.VERSIONS.get("@smithy/core");
    }

    /**
     * Note: if AWS SDK codegen is not loaded, then this will not work correctly.
     *
     * @return the leading AWS SDK client version, used in @aws-sdk/ckient versioning scheme.
     */
    public static String getAwsSdkLeadingClientVersion() {
        return SdkVersion.getLeadingAwsSdkClientVersion();
    }

    @Override
    public List<SymbolDependency> getDependencies() {
        return Collections.singletonList(dependency);
    }

    @Override
    public String getPackageName() {
        return this.packageName;
    }

    /**
     * Creates a Symbol from the dependency of the enum, using the package
     * name and version of the dependency and the provided {@code name}.
     *
     * <p>The created Symbol will have a dependency on the enum's
     * dependency.
     *
     * @param name Name to attach to the symbol.
     * @return Returns the created Symbol.
     */
    public Symbol createSymbol(String name) {
        return Symbol.builder()
            .namespace(dependency.getPackageName(), "/")
            .name(name)
            .addDependency(dependency)
            .build();
    }

    private boolean isUnconditional() {
        return dependency.expectProperty("unconditional", Boolean.class);
    }

    /**
     * Reads the versions of AWS-published libraries from smithy-aws-typescript-codegen, if it's available
     * on the classpath.
     */
    private static final class SdkVersion {

        private static final Logger LOGGER = Logger.getLogger(SdkVersion.class.getName());
        private static final String PROPERTIES_PATH =
            "/software/amazon/smithy/aws/typescript/codegen/sdkVersions.properties";
        private static final Map<String, String> VERSIONS;

        static {
            Map<String, String> tmpVersions;
            try {
                URL versionsUrl = SdkVersion.class.getResource(PROPERTIES_PATH);
                if (versionsUrl == null) {
                    throw new IOException();
                }
                Properties p = new Properties();
                try (
                    Reader r = new BufferedReader(
                        new InputStreamReader(versionsUrl.openStream(), StandardCharsets.UTF_8)
                    )
                ) {
                    p.load(r);
                }
                final Map<String, String> versions = new HashMap<>(p.size());
                p.forEach((k, v) -> {
                    if (versions.put(k.toString(), v.toString()) != null) {
                        throw new IllegalArgumentException(String.format("Multiple versions defined for %s", k));
                    }
                });
                tmpVersions = Collections.unmodifiableMap(versions);
            } catch (IOException e) {
                LOGGER.fine(
                    "Could not read AWS dependency versions from smithy-aws-typescript-codegen, " +
                        "will use 'latest' for AWS dependencies"
                );
                tmpVersions = Collections.emptyMap();
            }
            VERSIONS = tmpVersions;
        }

        /**
         * @return highest client version in the sdkVersions.properties file.
         */
        public static String getLeadingAwsSdkClientVersion() {
            int major = 0;
            int minor = 0;
            int patch = 0;

            for (Map.Entry<String, String> entry : VERSIONS.entrySet()) {
                String packageName = entry.getKey();
                String version = entry.getValue();

                boolean isClient = packageName.startsWith("@aws-sdk/client-");
                if (isClient) {
                    boolean isSemverTrinumeric = version.matches("^\\d+\\.\\d+\\.\\d+$");
                    if (isSemverTrinumeric) {
                        String[] semver = version.split("\\.");
                        major = Math.max(Integer.parseInt(semver[0]), major);
                        minor = Math.max(Integer.parseInt(semver[1]), minor);
                        patch = Math.max(Integer.parseInt(semver[2]), patch);
                    }
                }
            }
            return "%s.%s.%s".formatted(major, minor, patch);
        }

        private static String getVersion(String packageName) {
            return VERSIONS.getOrDefault(packageName, "latest");
        }
    }

    /**
     * Reads the version of smithy-typescript published libraries.
     */
    private static final class DependencyVersion {

        private static final Logger LOGGER = Logger.getLogger(DependencyVersion.class.getName());
        private static final Map<String, String> VERSIONS;

        static {
            Map<String, String> tmpVersions;
            try {
                URL versionsUrl = DependencyVersion.class.getResource("dependencyVersions.properties");
                if (versionsUrl == null) {
                    throw new IOException();
                }
                Properties p = new Properties();
                try (
                    Reader r = new BufferedReader(
                        new InputStreamReader(versionsUrl.openStream(), StandardCharsets.UTF_8)
                    )
                ) {
                    p.load(r);
                }
                final Map<String, String> versions = new HashMap<>(p.size());
                p.forEach((k, v) -> {
                    if (versions.put(k.toString(), v.toString()) != null) {
                        throw new IllegalArgumentException(String.format("Multiple versions defined for %s", k));
                    }
                });
                tmpVersions = Collections.unmodifiableMap(versions);
            } catch (IOException e) {
                LOGGER.warning("Could not read dependency versions from smithy-typescript-codegen");
                tmpVersions = Collections.emptyMap();
            }
            VERSIONS = tmpVersions;
        }

        private static String getVersion(String packageName) {
            return VERSIONS.get(packageName);
        }
    }
}
