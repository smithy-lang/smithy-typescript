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

package software.amazon.smithy.typescript.codegen.integration;

import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.model.knowledge.HttpBinding.Location;
import software.amazon.smithy.model.knowledge.HttpBindingIndex;
import software.amazon.smithy.model.shapes.BigDecimalShape;
import software.amazon.smithy.model.shapes.BigIntegerShape;
import software.amazon.smithy.model.shapes.BlobShape;
import software.amazon.smithy.model.shapes.BooleanShape;
import software.amazon.smithy.model.shapes.ByteShape;
import software.amazon.smithy.model.shapes.DocumentShape;
import software.amazon.smithy.model.shapes.DoubleShape;
import software.amazon.smithy.model.shapes.FloatShape;
import software.amazon.smithy.model.shapes.IntegerShape;
import software.amazon.smithy.model.shapes.ListShape;
import software.amazon.smithy.model.shapes.LongShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ResourceShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.SetShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeVisitor;
import software.amazon.smithy.model.shapes.ShortShape;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.TimestampFormatTrait.Format;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator.GenerationContext;
import software.amazon.smithy.typescript.codegen.knowledge.SerdeElisionIndex;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Visitor to generate member values for aggregate types deserialized from documents.
 *
 * The standard implementations are as follows; these implementations may be
 * overridden unless otherwise specified.
 *
 * <ul>
 *   <li>Blob: base64 decoded.</li>
 *   <li>BigInteger: converted to JS BigInt.</li>
 *   <li>BigDecimal: converted to Big via {@code big.js}.</li>
 *   <li>Timestamp: converted to JS Date.</li>
 *   <li>Service, Operation, Resource, Member: not deserializable from documents. <b>Not overridable.</b></li>
 *   <li>Document, List, Map, Set, Structure, Union: delegated to a deserialization function.
 *     <b>Not overridable.</b></li>
 *   <li>All other types: unmodified.</li>
 * </ul>
 */
@SmithyUnstableApi
public class DocumentMemberDeserVisitor implements ShapeVisitor<String> {
    protected boolean serdeElisionEnabled;
    private final GenerationContext context;
    private final String dataSource;
    private final Format defaultTimestampFormat;
    private final SerdeElisionIndex serdeElisionIndex;

    /**
     * Constructor.
     *
     * @param context The generation context.
     * @param dataSource The in-code location of the data to provide an output of
     *                   ({@code output.foo}, {@code entry}, etc.)
     * @param defaultTimestampFormat The default timestamp format used in absence
     *                               of a TimestampFormat trait.
     */
    public DocumentMemberDeserVisitor(
            GenerationContext context,
            String dataSource,
            Format defaultTimestampFormat
    ) {
        this.context = context;
        this.dataSource = dataSource;
        this.defaultTimestampFormat = defaultTimestampFormat;
        this.serdeElisionEnabled = false;
        this.serdeElisionIndex = SerdeElisionIndex.of(context.getModel());
    }

    /**
     * @return the member this visitor is being run against. Used to discover member-applied
     * traits, such as @timestampFormat. Can be, and defaults, to, null.
     */
    protected MemberShape getMemberShape() {
        return null;
    }

    /**
     * @return true if string-formatted epoch seconds in payloads are disallowed. Defaults to false.
     */
    protected boolean requiresNumericEpochSecondsInPayload() {
        return false;
    }

    /**
     * Gets the generation context.
     *
     * @return The generation context.
     */
    protected final GenerationContext getContext() {
        return context;
    }

    /**
     * Gets the in-code location of the data to provide an output of
     * ({@code output.foo}, {@code entry}, etc.).
     *
     * @return The data source.
     */
    protected final String getDataSource() {
        return dataSource;
    }

    /**
     * Gets the default timestamp format used in absence of a TimestampFormat trait.
     *
     * @return The default timestamp format.
     */
    protected final Format getDefaultTimestampFormat() {
        return defaultTimestampFormat;
    }

    @Override
    public String blobShape(BlobShape shape) {
        return "context.base64Decoder(" + dataSource + ")";
    }

    @Override
    public String booleanShape(BooleanShape shape) {
        context.getWriter().addImport("expectBoolean", "__expectBoolean", "@smithy/smithy-client");
        return "__expectBoolean(" + dataSource + ")";
    }

    @Override
    public String byteShape(ByteShape shape) {
        context.getWriter().addImport("expectByte", "__expectByte", "@smithy/smithy-client");
        return "__expectByte(" + dataSource + ")";
    }

    @Override
    public String shortShape(ShortShape shape) {
        context.getWriter().addImport("expectShort", "__expectShort", "@smithy/smithy-client");
        return "__expectShort(" + dataSource + ")";
    }

    @Override
    public String integerShape(IntegerShape shape) {
        context.getWriter().addImport("expectInt32", "__expectInt32", "@smithy/smithy-client");
        return "__expectInt32(" + dataSource + ")";
    }

    @Override
    public String longShape(LongShape shape) {
        context.getWriter().addImport("expectLong", "__expectLong", "@smithy/smithy-client");
        return "__expectLong(" + dataSource + ")";
    }

    @Override
    public String floatShape(FloatShape shape) {
        context.getWriter().addImport("limitedParseFloat32", "__limitedParseFloat32", "@smithy/smithy-client");
        return "__limitedParseFloat32(" + dataSource + ")";
    }

    @Override
    public String doubleShape(DoubleShape shape) {
        context.getWriter().addImport("limitedParseDouble", "__limitedParseDouble", "@smithy/smithy-client");
        return "__limitedParseDouble(" + dataSource + ")";
    }

    @Override
    public String stringShape(StringShape shape) {
        return HttpProtocolGeneratorUtils.getStringOutputParam(context, shape, dataSource);
    }

    @Override
    public String bigIntegerShape(BigIntegerShape shape) {
        // BigInt is not supported across all environments, use big.js instead.
        return deserializeToBigJs();
    }

    @Override
    public String bigDecimalShape(BigDecimalShape shape) {
        return deserializeToBigJs();
    }

    private String deserializeToBigJs() {
        context.getWriter().addImport("Big", "__Big", "big.js");
        return "__Big(" + dataSource + ")";
    }

    @Override
    public final String operationShape(OperationShape shape) {
        throw new CodegenException("Operation shapes cannot be bound to documents.");
    }

    @Override
    public final String resourceShape(ResourceShape shape) {
        throw new CodegenException("Resource shapes cannot be bound to documents.");
    }

    @Override
    public final String serviceShape(ServiceShape shape) {
        throw new CodegenException("Service shapes cannot be bound to documents.");
    }

    @Override
    public final String memberShape(MemberShape shape) {
        throw new CodegenException("Member shapes cannot be bound to documents.");
    }

    @Override
    public String timestampShape(TimestampShape shape) {
        HttpBindingIndex httpIndex = HttpBindingIndex.of(context.getModel());
        Format format;
        if (getMemberShape() == null) {
            format = httpIndex.determineTimestampFormat(shape, Location.DOCUMENT, defaultTimestampFormat);
        } else {
            if (!shape.getId().equals(getMemberShape().getTarget())) {
                throw new IllegalArgumentException(
                        String.format("Encountered timestamp shape %s that was not the target of member shape %s",
                                shape.getId(), getMemberShape().getId()));
            }
            format = httpIndex.determineTimestampFormat(getMemberShape(), Location.DOCUMENT, defaultTimestampFormat);
        }

        return HttpProtocolGeneratorUtils.getTimestampOutputParam(
                context.getWriter(),
                dataSource,
                Location.DOCUMENT,
                shape,
                format,
                requiresNumericEpochSecondsInPayload(),
                context.getSettings().generateClient());
    }

    @Override
    public final String documentShape(DocumentShape shape) {
        return getDelegateDeserializer(shape);
    }

    @Override
    public final String listShape(ListShape shape) {
        return getDelegateDeserializer(shape);
    }

    @Override
    public final String mapShape(MapShape shape) {
        return getDelegateDeserializer(shape);
    }

    @Override
    public final String setShape(SetShape shape) {
        return getDelegateDeserializer(shape);
    }

    @Override
    public final String structureShape(StructureShape shape) {
        return getDelegateDeserializer(shape);
    }

    @Override
    public final String unionShape(UnionShape shape) {
        context.getWriter().addImport("expectUnion", "__expectUnion", "@smithy/smithy-client");
        return getDelegateDeserializer(shape, "__expectUnion(" + dataSource + ")");
    }

    private String getDelegateDeserializer(Shape shape) {
        return getDelegateDeserializer(shape, dataSource);
    }

    private String getDelegateDeserializer(Shape shape, String customDataSource) {
        // Use the shape for the function name.
        Symbol symbol = context.getSymbolProvider().toSymbol(shape);

        if (serdeElisionEnabled && serdeElisionIndex.mayElide(shape)) {
            return "_json(" + customDataSource + ")";
        }

        return ProtocolGenerator.getDeserFunctionShortName(symbol)
                + "(" + customDataSource + ", context)";
    }
}
