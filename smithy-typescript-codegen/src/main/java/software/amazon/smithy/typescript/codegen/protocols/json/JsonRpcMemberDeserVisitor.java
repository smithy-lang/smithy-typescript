/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.protocols.json;

import software.amazon.smithy.model.knowledge.HttpBinding;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.typescript.codegen.SmithyCoreSubmodules;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.integration.DocumentMemberDeserVisitor;
import software.amazon.smithy.typescript.codegen.integration.HttpProtocolGeneratorUtils;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;

/**
 * Deserializes member values for the Smithy RPCv2 JSON protocol.
 *
 * <p>This relies on the JSON-correct defaults provided by
 * {@link DocumentMemberDeserVisitor}:
 * <ul>
 *   <li>blob: base64 decoded (JSON.parse does not base64 decode blobs).</li>
 *   <li>bigInteger/bigDecimal: parsed from strings to preserve precision.</li>
 * </ul>
 *
 * <p>Per the Smithy RPCv2 JSON specification, timestamps are always deserialized
 * as epoch-seconds and the {@code timestampFormat} trait is not respected.
 */
public class JsonRpcMemberDeserVisitor extends DocumentMemberDeserVisitor {

    private final ProtocolGenerator.GenerationContext context;
    private final String dataSource;

    /**
     * Constructor.
     *
     * @param context    The generation context.
     * @param dataSource The in-code location of the data to provide an output of
     *                   ({@code output.foo}, {@code entry}, etc.)
     */
    public JsonRpcMemberDeserVisitor(ProtocolGenerator.GenerationContext context, String dataSource) {
        super(context, dataSource, TimestampFormatTrait.Format.EPOCH_SECONDS);
        this.context = context;
        context.getWriter()
            .addImportSubmodule("_json", null, TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CLIENT);
        this.serdeElisionEnabled = !context.getSettings().generateServerSdk();
        this.dataSource = dataSource;
    }

    /**
     * RPCv2 JSON always deserializes timestamps as epoch-seconds, ignoring the
     * model's timestampFormat trait.
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
