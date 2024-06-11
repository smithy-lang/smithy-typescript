/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.protocols.cbor;

import software.amazon.smithy.model.shapes.BlobShape;
import software.amazon.smithy.model.shapes.DoubleShape;
import software.amazon.smithy.model.shapes.FloatShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.typescript.codegen.integration.DocumentMemberSerVisitor;
import software.amazon.smithy.typescript.codegen.integration.HttpProtocolGeneratorUtils;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;

public class CborMemberSerVisitor extends DocumentMemberSerVisitor {

    private final String dataSource;
    private final ProtocolGenerator.GenerationContext context;
    private final TimestampFormatTrait.Format defaultTimestampFormat;

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
        this.context = context;
        this.defaultTimestampFormat = defaultTimestampFormat;
        this.serdeElisionEnabled = true;
        this.dataSource = dataSource;
    }

    /**
     * This differs from the base method in that CBOR does not need to wrap
     * the blob value in `context.base64Encoder(...)`. The CBOR format serializer
     * already does this whereas e.g. JSON.stringify does not.
     */
    @Override
    public String blobShape(BlobShape shape) {
        return dataSource;
    }

    /**
     * +/- Infinity and NaN have byte representations. No need to
     * serialize those values with serializeFloat().
     */
    @Override
    public String floatShape(FloatShape shape) {
        return dataSource;
    }

    /**
     * +/- Infinity and NaN have byte representations. No need to
     * serialize those values with serializeFloat().
     */
    @Override
    public String doubleShape(DoubleShape shape) {
        return dataSource;
    }

    /**
     * CBOR serialization needs a JS object identifiable as a tag.
     */
    @Override
    public String timestampShape(TimestampShape shape) {
        final String timestamp = HttpProtocolGeneratorUtils.getTimestampInputParam(
            context, dataSource, shape, defaultTimestampFormat
        );
        return """
            ({
              tag: 1,
              value: %s
            })
            """.formatted(timestamp);
    }
}
