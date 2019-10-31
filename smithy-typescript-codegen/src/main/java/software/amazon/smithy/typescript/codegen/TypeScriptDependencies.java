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

import software.amazon.smithy.codegen.core.SymbolDependency;

public final class TypeScriptDependencies {
    public static final String NORMAL_DEPENDENCY = "dependencies";
    public static final String DEV_DEPENDENCY = "devDependencies";
    public static final String PEER_DEPENDENCY = "peerDependencies";
    public static final String BUNDLED_DEPENDENCY = "bundledDependencies";
    public static final String OPTIONAL_DEPENDENCY = "optionalDependencies";

    public static final SymbolDependency HTTP_PROTOCOL = SymbolDependency.builder()
            .dependencyType(NORMAL_DEPENDENCY)
            .packageName("@aws-sdk/protocol-http")
            .version("^0.1.0-preview.1")
            .build();

    public static final SymbolDependency MIDDLEWARE_SERDE = SymbolDependency.builder()
            .dependencyType(NORMAL_DEPENDENCY)
            .packageName("@aws-sdk/middleware-serde")
            .version("^0.1.0-preview.1")
            .build();

    public static final SymbolDependency TYPES_NODE = SymbolDependency.builder()
            .dependencyType(DEV_DEPENDENCY)
            .packageName("@types/node")
            .version("^12.7.5")
            .build();

    public static final SymbolDependency TYPES_BIG_JS = SymbolDependency.builder()
            .dependencyType(DEV_DEPENDENCY)
            .packageName("@types/big.js")
            .version("^4.0.5")
            .build();

    public static final SymbolDependency BIG_JS = SymbolDependency.builder()
            .dependencyType(NORMAL_DEPENDENCY)
            .packageName("big.js")
            .version("^5.2.2")
            .build();

    public static final SymbolDependency AWS_SDK_TYPES = SymbolDependency.builder()
            .dependencyType(NORMAL_DEPENDENCY)
            .packageName("@aws-sdk/types")
            .version("^0.1.0-preview.5")
            .build();

    public static final SymbolDependency AWS_SMITHY_CLIENT = SymbolDependency.builder()
            .dependencyType(NORMAL_DEPENDENCY)
            .packageName("@aws-sdk/smithy-client")
            .version("^0.1.0-preview.5")
            .build();

    private TypeScriptDependencies() {}
}
