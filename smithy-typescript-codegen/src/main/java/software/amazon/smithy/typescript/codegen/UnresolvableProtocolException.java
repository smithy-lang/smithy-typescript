/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.utils.SmithyUnstableApi;

@SmithyUnstableApi
public class UnresolvableProtocolException extends CodegenException {
    public UnresolvableProtocolException(String message) {
        super(message);
    }
}
