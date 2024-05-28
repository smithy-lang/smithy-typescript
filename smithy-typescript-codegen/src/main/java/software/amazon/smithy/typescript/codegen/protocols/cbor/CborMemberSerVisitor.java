/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.protocols.cbor;

import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.typescript.codegen.integration.DocumentMemberSerVisitor;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;

public class CborMemberSerVisitor extends DocumentMemberSerVisitor {

    /**
     * Constructor.
     *
     * @param context                The generation context.
     * @param dataSource             The in-code location of the data to provide an input of
     *                               ({@code input.foo}, {@code entry}, etc.)
     * @param defaultTimestampFormat The default timestamp format used in absence
     *                               of a TimestampFormat trait.
     */
    public CborMemberSerVisitor(ProtocolGenerator.GenerationContext context,
                                String dataSource,
                                TimestampFormatTrait.Format defaultTimestampFormat) {
        super(context, dataSource, defaultTimestampFormat);
    }
}
