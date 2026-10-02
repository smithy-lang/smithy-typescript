/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.protocols.json;

import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.typescript.codegen.integration.DocumentMemberSerVisitor;
import software.amazon.smithy.typescript.codegen.integration.HttpProtocolGeneratorUtils;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;

/**
 * Serializes member values for the Smithy RPCv2 JSON protocol.
 *
 * <p>Unlike the CBOR member visitor, this relies on the JSON-correct defaults
 * provided by {@link DocumentMemberSerVisitor}:
 * <ul>
 *   <li>blob: base64 encoded (JSON.stringify does not base64 encode blobs).</li>
 *   <li>float/double: NaN/Infinity serialized as strings.</li>
 *   <li>bigInteger/bigDecimal: serialized as strings to preserve precision.</li>
 * </ul>
 *
 * <p>Per the Smithy RPCv2 JSON specification, timestamps MUST be serialized as
 * epoch-seconds and the {@code timestampFormat} trait MUST NOT be respected.
 */
public class JsonRpcMemberSerVisitor extends DocumentMemberSerVisitor {

    /**
     * The service model's timestampFormat is ignored in RPCv2 JSON protocol.
     */
    private static final TimestampFormatTrait.Format TIMESTAMP_FORMAT = TimestampFormatTrait.Format.EPOCH_SECONDS;

    private final ProtocolGenerator.GenerationContext context;
    private final String dataSource;

    /**
     * Constructor.
     *
     * @param context    The generation context.
     * @param dataSource The in-code location of the data to provide an input of
     *                   ({@code input.foo}, {@code entry}, etc.)
     */
    public JsonRpcMemberSerVisitor(ProtocolGenerator.GenerationContext context, String dataSource) {
        super(context, dataSource, TIMESTAMP_FORMAT);
        this.context = context;
        this.serdeElisionEnabled = true;
        this.dataSource = dataSource;
    }

    /**
     * RPCv2 JSON always serializes timestamps as epoch-seconds, ignoring the
     * model's timestampFormat trait.
     */
    @Override
    public String timestampShape(TimestampShape shape) {
        return HttpProtocolGeneratorUtils.getTimestampInputParam(context, dataSource, shape, TIMESTAMP_FORMAT);
    }
}
