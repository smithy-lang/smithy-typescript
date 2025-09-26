/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.protocols.cbor;

import software.amazon.smithy.model.shapes.BigDecimalShape;
import software.amazon.smithy.model.shapes.BigIntegerShape;
import software.amazon.smithy.model.shapes.BlobShape;
import software.amazon.smithy.model.shapes.DoubleShape;
import software.amazon.smithy.model.shapes.FloatShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.typescript.codegen.SmithyCoreSubmodules;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.integration.DocumentMemberSerVisitor;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;

public class CborMemberSerVisitor extends DocumentMemberSerVisitor {

    private final String dataSource;
    private final ProtocolGenerator.GenerationContext context;

    /**
     * Constructor.
     *
     * @param context                The generation context.
     * @param dataSource             The in-code location of the data to provide an input of
     *                               ({@code input.foo}, {@code entry}, etc.)
     */
    public CborMemberSerVisitor(ProtocolGenerator.GenerationContext context,
                                String dataSource) {
        super(context, dataSource, TimestampFormatTrait.Format.EPOCH_SECONDS);
        this.context = context;
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
     * Use bigint from JS.
     */
    @Override
    public String bigIntegerShape(BigIntegerShape shape) {
        if (context.getSettings().getBigNumberMode().equals("big.js")) {
            return "BigInt(" + dataSource + ")";
        }
        return dataSource;
    }

    /**
     * Use NumericValue from \@smithy/core/serde.
     */
    @Override
    public String bigDecimalShape(BigDecimalShape shape) {
        context.getWriter().addImportSubmodule(
            "nv", "__nv", TypeScriptDependency.SMITHY_CORE, "/serde"
        );
        return "__nv(" + dataSource + ")";
    }

    /**
     * CBOR serialization needs a JS object identifiable as a tag.
     */
    @Override
    public String timestampShape(TimestampShape shape) {
        context.getWriter().addImportSubmodule(
            "dateToTag",
            "__dateToTag",
            TypeScriptDependency.SMITHY_CORE,
            SmithyCoreSubmodules.CBOR
        );
        return "__dateToTag(" + dataSource + ")";
    }
}
