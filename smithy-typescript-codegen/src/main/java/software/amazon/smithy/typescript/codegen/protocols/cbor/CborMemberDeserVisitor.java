/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.protocols.cbor;

import software.amazon.smithy.model.knowledge.HttpBinding;
import software.amazon.smithy.model.shapes.BlobShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.integration.DocumentMemberDeserVisitor;
import software.amazon.smithy.typescript.codegen.integration.HttpProtocolGeneratorUtils;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;

public class CborMemberDeserVisitor extends DocumentMemberDeserVisitor {
    private final String dataSource;
    private final ProtocolGenerator.GenerationContext context;

    /**
     * Constructor.
     *
     * @param context                The generation context.
     * @param dataSource             The in-code location of the data to provide an output of
     *                               ({@code output.foo}, {@code entry}, etc.)
     */
    public CborMemberDeserVisitor(ProtocolGenerator.GenerationContext context,
                                  String dataSource) {
        super(context, dataSource, TimestampFormatTrait.Format.EPOCH_SECONDS);
        this.context = context;
        context.getWriter().addImport("_json", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
        this.serdeElisionEnabled = !context.getSettings().generateServerSdk();
        this.dataSource = dataSource;
    }

    /**
     * This differs from the base method in that CBOR does not need to wrap
     * the blob value in `context.base64Decoder(...)`. The CBOR format deserializer
     * already does this whereas e.g. JSON.parse does not.
     */
    @Override
    public String blobShape(BlobShape shape) {
        return dataSource;
    }

    /**
     * Smithy RPCv2 CBOR only allows the epoch-seconds format, ignoring the model's
     * timestamp trait.
     */
    @Override
    public String timestampShape(TimestampShape shape) {
        return HttpProtocolGeneratorUtils.getTimestampOutputParam(
            context.getWriter(),
            dataSource,
            HttpBinding.Location.DOCUMENT,
            shape,
            TimestampFormatTrait.Format.EPOCH_SECONDS,
            requiresNumericEpochSecondsInPayload(),
            context.getSettings().generateClient()
        );
    }
}
