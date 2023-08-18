/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http;

import java.util.function.Consumer;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Definition of an HttpAuthSchemeParameter.
 *
 * Currently this is used to generate the the HttpAuthSchemeParameters interface in `experimentalIdentityAndAuth`.
 *
 * @param name name of the auth scheme parameter
 * @param type writer for the type of the auth scheme parameter
 * @param source writer for the value of the auth scheme parameter, typically from {@code context} or {@code config}
 */
@SmithyUnstableApi
public final record HttpAuthSchemeParameter(
    String name,
    Consumer<TypeScriptWriter> type,
    Consumer<TypeScriptWriter> source
) {}
