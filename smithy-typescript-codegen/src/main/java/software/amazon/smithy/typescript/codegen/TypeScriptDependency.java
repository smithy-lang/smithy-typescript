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


import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.codegen.core.SymbolDependencyContainer;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * An enum of all of the built-in dependencies managed by this package.
 */
@SmithyUnstableApi
public enum TypeScriptDependency implements SymbolDependencyContainer {

    AWS_SDK_CLIENT_DOCGEN("devDependencies", "@aws-sdk/client-documentation-generator", SdkVersion.LIVE, true),
    AWS_SDK_TYPES("dependencies", "@aws-sdk/types", SdkVersion.LIVE, true),
    AWS_SMITHY_CLIENT("dependencies", "@aws-sdk/smithy-client", SdkVersion.LIVE, true),
    INVALID_DEPENDENCY("dependencies", "@aws-sdk/invalid-dependency", SdkVersion.LIVE, true),
    CONFIG_RESOLVER("dependencies", "@aws-sdk/config-resolver", SdkVersion.LIVE, true),
    TYPES_NODE("devDependencies", "@types/node", "^12.7.5", true),

    MIDDLEWARE_CONTENT_LENGTH("dependencies", "@aws-sdk/middleware-content-length", SdkVersion.LIVE, true),
    MIDDLEWARE_SERDE("dependencies", "@aws-sdk/middleware-serde", SdkVersion.LIVE, true),
    MIDDLEWARE_RETRY("dependencies", "@aws-sdk/middleware-retry", SdkVersion.LIVE, true),
    MIDDLEWARE_STACK("dependencies", "@aws-sdk/middleware-stack", SdkVersion.LIVE, true),

    AWS_CRYPTO_SHA256_BROWSER("dependencies", "@aws-crypto/sha256-browser", "^1.1.0", true),
    AWS_CRYPTO_SHA256_JS("dependencies", "@aws-crypto/sha256-js", "^1.1.0", true),
    AWS_SDK_HASH_NODE("dependencies", "@aws-sdk/hash-node", SdkVersion.LIVE, true),

    AWS_SDK_URL_PARSER("dependencies", "@aws-sdk/url-parser", SdkVersion.LIVE, true),

    AWS_SDK_UTIL_BASE64_BROWSER("dependencies", "@aws-sdk/util-base64-browser", SdkVersion.LIVE, true),
    AWS_SDK_UTIL_BASE64_NODE("dependencies", "@aws-sdk/util-base64-node", SdkVersion.LIVE, true),

    AWS_SDK_UTIL_BODY_LENGTH_BROWSER("dependencies", "@aws-sdk/util-body-length-browser", SdkVersion.LIVE, true),
    AWS_SDK_UTIL_BODY_LENGTH_NODE("dependencies", "@aws-sdk/util-body-length-node", SdkVersion.LIVE, true),

    AWS_SDK_UTIL_UTF8_BROWSER("dependencies", "@aws-sdk/util-utf8-browser", SdkVersion.LIVE, true),
    AWS_SDK_UTIL_UTF8_NODE("dependencies", "@aws-sdk/util-utf8-node", SdkVersion.LIVE, true),

    AWS_SDK_UTIL_WAITERS("dependencies", "@aws-sdk/util-waiter",  SdkVersion.LIVE, false),

    // Conditionally added when httpChecksumRequired trait exists
    MD5_BROWSER("dependencies", "@aws-sdk/md5-js", SdkVersion.LIVE, false),
    STREAM_HASHER_NODE("dependencies", "@aws-sdk/hash-stream-node", SdkVersion.LIVE, false),
    STREAM_HASHER_BROWSER("dependencies", "@aws-sdk/hash-blob-browser", SdkVersion.LIVE, false),
    BODY_CHECKSUM("dependencies", "@aws-sdk/middleware-apply-body-checksum", SdkVersion.LIVE, false),

    // Conditionally added when using an HTTP application protocol.
    AWS_SDK_PROTOCOL_HTTP("dependencies", "@aws-sdk/protocol-http", SdkVersion.LIVE, false),
    AWS_SDK_FETCH_HTTP_HANDLER("dependencies", "@aws-sdk/fetch-http-handler", SdkVersion.LIVE, false),
    AWS_SDK_NODE_HTTP_HANDLER("dependencies", "@aws-sdk/node-http-handler", SdkVersion.LIVE, false),

    // Conditionally added if a event stream shape is found anywhere in the model
    AWS_SDK_EVENTSTREAM_SERDE_CONFIG_RESOLVER("dependencies", "@aws-sdk/eventstream-serde-config-resolver",
            SdkVersion.LIVE, false),
    AWS_SDK_EVENTSTREAM_SERDE_NODE("dependencies", "@aws-sdk/eventstream-serde-node", SdkVersion.LIVE, false),
    AWS_SDK_EVENTSTREAM_SERDE_BROWSER("dependencies", "@aws-sdk/eventstream-serde-browser", SdkVersion.LIVE, false),

    // Conditionally added if a big decimal shape is found in a model.
    BIG_JS("dependencies", "big.js", "^5.2.2", false),
    TYPES_BIG_JS("devDependencies", "@types/big.js", "^4.0.5", false),

    // Conditionally added when interacting with specific protocol test bodyMediaType values.
    AWS_SDK_QUERYSTRING_BUILDER("dependencies", "@aws-sdk/querystring-builder", SdkVersion.LIVE, false),

    // Conditionally added when XML parser needs to be used.
    XML_PARSER("dependencies", "fast-xml-parser", "3.19.0", false),
    HTML_ENTITIES("dependencies", "entities", "2.2.0", false),

    // Server dependency for SSDKs
    SERVER_COMMON("dependencies", "@aws-smithy/server-common", "^1.0.0-alpha.0", false);

    public static final String NORMAL_DEPENDENCY = "dependencies";
    public static final String DEV_DEPENDENCY = "devDependencies";
    public static final String PEER_DEPENDENCY = "peerDependencies";
    public static final String BUNDLED_DEPENDENCY = "bundledDependencies";
    public static final String OPTIONAL_DEPENDENCY = "optionalDependencies";

    public final String packageName;
    public final String version;
    public final SymbolDependency dependency;

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
     * Holds package-wide constants, such as the current version of the AWS SDK for JS v3.
     */
    private static final class SdkVersion {
        static final String LIVE = "3.18.0";

        private SdkVersion() {}
    }
}
