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

/**
 * An enum of all of the built-in dependencies managed by this package.
 */
public enum TypeScriptDependency implements SymbolDependencyContainer {

    TS_LIB("devDependencies", "tslib", "^1.8.0", true),
    AWS_SDK_TYPES("dependencies", "@aws-sdk/types", "^1.0.0-alpha.1", true),
    AWS_SMITHY_CLIENT("dependencies", "@aws-sdk/smithy-client", "^1.0.0-alpha.1", true),
    INVALID_DEPENDENCY("dependencies", "@aws-sdk/invalid-dependency", "^1.0.0-alpha.1", true),
    CONFIG_RESOLVER("dependencies", "@aws-sdk/config-resolver", "^1.0.0-alpha.1", true),
    TYPES_NODE("devDependencies", "@types/node", "^12.7.5", true),

    MIDDLEWARE_CONTENT_LENGTH("dependencies", "@aws-sdk/middleware-content-length", "^1.0.0-alpha.1", true),
    MIDDLEWARE_SERDE("dependencies", "@aws-sdk/middleware-serde", "^1.0.0-alpha.1", true),
    MIDDLEWARE_USER_AGENT("dependencies", "@aws-sdk/middleware-user-agent", "^1.0.0-alpha.1", true),
    MIDDLEWARE_RETRY("dependencies", "@aws-sdk/middleware-retry", "^1.0.0-alpha.1", true),
    MIDDLEWARE_STACK("dependencies", "@aws-sdk/middleware-stack", "^1.0.0-alpha.1", true),

    AWS_CRYPTO_SHA256_BROWSER("dependencies", "@aws-crypto/sha256-browser", "^0.1.0-preview.4", true),
    AWS_SDK_HASH_NODE("dependencies", "@aws-sdk/hash-node", "^1.0.0-alpha.1", true),

    AWS_SDK_STREAM_COLLECTOR_NODE("dependencies", "@aws-sdk/stream-collector-node", "^1.0.0-alpha.1", true),
    AWS_SDK_STREAM_COLLECTOR_BROWSER("dependencies", "@aws-sdk/stream-collector-browser", "^1.0.0-alpha.1", true),
    AWS_SDK_STREAM_COLLECTOR_RN("dependencies", "@aws-sdk/stream-collector-rn", "^1.0.0-alpha.0", true),

    AWS_SDK_URL_PARSER_BROWSER("dependencies", "@aws-sdk/url-parser-browser", "^1.0.0-alpha.1", true),
    AWS_SDK_URL_PARSER_NODE("dependencies", "@aws-sdk/url-parser-node", "^1.0.0-alpha.1", true),

    AWS_SDK_UTIL_BASE64_BROWSER("dependencies", "@aws-sdk/util-base64-browser", "^1.0.0-alpha.1", true),
    AWS_SDK_UTIL_BASE64_NODE("dependencies", "@aws-sdk/util-base64-node", "^1.0.0-alpha.1", true),

    AWS_SDK_UTIL_BODY_LENGTH_BROWSER("dependencies", "@aws-sdk/util-body-length-browser", "^1.0.0-alpha.1", true),
    AWS_SDK_UTIL_BODY_LENGTH_NODE("dependencies", "@aws-sdk/util-body-length-node", "^1.0.0-alpha.1", true),

    AWS_SDK_UTIL_USER_AGENT_BROWSER("dependencies", "@aws-sdk/util-user-agent-browser", "^1.0.0-alpha.1", true),
    AWS_SDK_UTIL_USER_AGENT_NODE("dependencies", "@aws-sdk/util-user-agent-node", "^1.0.0-alpha.1", true),

    AWS_SDK_UTIL_UTF8_BROWSER("dependencies", "@aws-sdk/util-utf8-browser", "^1.0.0-alpha.1", true),
    AWS_SDK_UTIL_UTF8_NODE("dependencies", "@aws-sdk/util-utf8-node", "^1.0.0-alpha.1", true),

    // Conditionally added when using an HTTP application protocol.
    AWS_SDK_PROTOCOL_HTTP("dependencies", "@aws-sdk/protocol-http", "^1.0.0-alpha.1", false),
    AWS_SDK_FETCH_HTTP_HANDLER("dependencies", "@aws-sdk/fetch-http-handler", "^1.0.0-alpha.1", false),
    AWS_SDK_NODE_HTTP_HANDLER("dependencies", "@aws-sdk/node-http-handler", "^1.0.0-alpha.1", false),

    // Conditionally added if a big decimal shape is found in a model.
    BIG_JS("dependencies", "big.js", "^5.2.2", false),
    TYPES_BIG_JS("devDependencies", "@types/big.js", "^4.0.5", false);

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
}
