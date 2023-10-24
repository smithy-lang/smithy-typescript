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

    AWS_SDK_CLIENT_DOCGEN("devDependencies", "@smithy/service-client-documentation-generator", true),
    AWS_SDK_TYPES("dependencies", "@aws-sdk/types", true),
    SMITHY_TYPES("dependencies", "@smithy/types", true),
    AWS_SMITHY_CLIENT("dependencies", "@smithy/smithy-client", true),
    INVALID_DEPENDENCY("dependencies", "@smithy/invalid-dependency", true),
    CONFIG_RESOLVER("dependencies", "@smithy/config-resolver", true),
    TYPES_NODE("devDependencies", "@types/node", "^14.14.31", true),

    MIDDLEWARE_CONTENT_LENGTH("dependencies", "@smithy/middleware-content-length", true),
    MIDDLEWARE_SERDE("dependencies", "@smithy/middleware-serde", true),
    MIDDLEWARE_RETRY("dependencies", "@smithy/middleware-retry", true),
    UTIL_RETRY("dependencies", "@smithy/util-retry", false),
    MIDDLEWARE_STACK("dependencies", "@smithy/middleware-stack", true),
    MIDDLEWARE_ENDPOINTS_V2("dependencies", "@smithy/middleware-endpoint", false),
    @Deprecated AWS_SDK_UTIL_ENDPOINTS("dependencies", "@aws-sdk/util-endpoints", false),
    UTIL_ENDPOINTS("dependencies", "@smithy/util-endpoints", false),

    AWS_CRYPTO_SHA256_BROWSER("dependencies", "@aws-crypto/sha256-browser", "3.0.0", true),
    AWS_CRYPTO_SHA256_JS("dependencies", "@aws-crypto/sha256-js", "3.0.0", true),

    AWS_SDK_HASH_NODE("dependencies", "@smithy/hash-node", true),

    AWS_SDK_URL_PARSER("dependencies", "@smithy/url-parser", true),

    @Deprecated AWS_SDK_UTIL_BASE64_BROWSER("dependencies", "@aws-sdk/util-base64-browser", false),
    @Deprecated AWS_SDK_UTIL_BASE64_NODE("dependencies", "@aws-sdk/util-base64-node", false),
    AWS_SDK_UTIL_BASE64("dependencies", "@smithy/util-base64", true),

    AWS_SDK_UTIL_BODY_LENGTH_BROWSER("dependencies", "@smithy/util-body-length-browser", true),
    AWS_SDK_UTIL_BODY_LENGTH_NODE("dependencies", "@smithy/util-body-length-node", true),

    AWS_SDK_UTIL_UTF8("dependencies", "@smithy/util-utf8", true),

    AWS_SDK_UTIL_WAITERS("dependencies", "@smithy/util-waiter",  false),

    AWS_SDK_UTIL_DEFAULTS_MODE_NODE("dependencies", "@smithy/util-defaults-mode-node", true),
    AWS_SDK_UTIL_DEFAULTS_MODE_BROWSER("dependencies", "@smithy/util-defaults-mode-browser", true),

    NODE_CONFIG_PROVIDER("dependencies", "@smithy/node-config-provider", false),

    UUID("dependencies", "uuid", "^8.3.2", false),

    // Conditionally added when httpChecksumRequired trait exists
    MD5_BROWSER("dependencies", "@smithy/md5-js", false),
    STREAM_HASHER_NODE("dependencies", "@smithy/hash-stream-node", false),
    STREAM_HASHER_BROWSER("dependencies", "@smithy/hash-blob-browser", false),
    BODY_CHECKSUM("dependencies", "@smithy/middleware-apply-body-checksum", false),

    // Conditionally added when using an HTTP application protocol.
    PROTOCOL_HTTP("dependencies", "@smithy/protocol-http", false),
    AWS_SDK_FETCH_HTTP_HANDLER("dependencies", "@smithy/fetch-http-handler", false),
    AWS_SDK_NODE_HTTP_HANDLER("dependencies", "@smithy/node-http-handler", false),

    // Conditionally added when setting the auth middleware.
    UTIL_MIDDLEWARE("dependencies", "@smithy/util-middleware", false),
    @Deprecated AWS_SDK_UTIL_MIDDLEWARE("dependencies", "@smithy/util-middleware", false),

    // Conditionally added if a event stream shape is found anywhere in the model
    AWS_SDK_EVENTSTREAM_SERDE_CONFIG_RESOLVER("dependencies", "@smithy/eventstream-serde-config-resolver",
        false),
    AWS_SDK_EVENTSTREAM_SERDE_NODE("dependencies", "@smithy/eventstream-serde-node", false),
    AWS_SDK_EVENTSTREAM_SERDE_BROWSER("dependencies", "@smithy/eventstream-serde-browser", false),

    // Conditionally added if a big decimal shape is found in a model.
    BIG_JS("dependencies", "big.js", "^6.0.0", false),
    TYPES_BIG_JS("devDependencies", "@types/big.js", "^6.0.0", false),

    // Conditionally added when interacting with specific protocol test bodyMediaType values.
    AWS_SDK_QUERYSTRING_BUILDER("dependencies", "@smithy/querystring-builder", false),

    // Conditionally added when XML parser needs to be used.
    XML_PARSER("dependencies", "fast-xml-parser", "4.2.5", false),
    HTML_ENTITIES("dependencies", "entities", "2.2.0", false),

    // Conditionally added when streaming blob response payload exists.
    @Deprecated UTIL_STREAM_NODE("dependencies", "@smithy/util-stream-node", false),
    @Deprecated UTIL_STREAM_BROWSER("dependencies", "@smithy/util-stream-browser", false),
    UTIL_STREAM("dependencies", "@smithy/util-stream", false),

    // Conditionally added when @aws.auth#sigv4 is used
    SIGNATURE_V4("dependencies", "@smithy/signature-v4", false),

    // feat(experimentalIdentityAndAuth): Conditionally added dependencies for `experimentalIdentityAndAuth`.
    // This package should never have a major version, and should only use minor and patch versions in development.
    EXPERIMENTAL_IDENTITY_AND_AUTH("dependencies", "@smithy/experimental-identity-and-auth", false),

    // Conditionally added when specs have been generated.
    VITEST("devDependencies", "vitest", "^0.33.0", false),

    // Server dependency for SSDKs
    SERVER_COMMON("dependencies", "@aws-smithy/server-common", false);

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

        if (name.startsWith("@smithy/")) {
            version = "^" + version;
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

    private boolean isUnconditional() {
        return dependency.expectProperty("unconditional", Boolean.class);
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
                try (Reader r =
                        new BufferedReader(new InputStreamReader(versionsUrl.openStream(), StandardCharsets.UTF_8))) {
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
                LOGGER.info("Could not read AWS dependency versions from smithy-aws-typescript-codegen, "
                        + "will use 'latest' for AWS dependencies");
                tmpVersions = Collections.emptyMap();
            }
            VERSIONS = tmpVersions;
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
                try (Reader r =
                        new BufferedReader(new InputStreamReader(versionsUrl.openStream(), StandardCharsets.UTF_8))) {
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
                LOGGER.info("Could not read dependency versions from smithy-typescript-codegen");
                tmpVersions = Collections.emptyMap();
            }
            VERSIONS = tmpVersions;
        }

        private static String getVersion(String packageName) {
            return VERSIONS.get(packageName);
        }
    }
}
