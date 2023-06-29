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
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator.GenerationContext;
import software.amazon.smithy.typescript.codegen.knowledge.SerdeElisionIndex;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Visitor to generate member values for aggregate types serialized in documents.
 *
 * The standard implementations are as follows; these implementations may be
 * overridden unless otherwise specified.
 *
 * <ul>
 *   <li>Blob: base64 encoded.</li>
 *   <li>BigInteger, BigDecimal: converted to strings to maintain precision.</li>
 *   <li>Timestamp: converted to a representation based on the specified format.</li>
 *   <li>Service, Operation, Resource, Member: not serializable in documents. <b>Not overridable.</b></li>
 *   <li>Document, List, Map, Set, Structure, Union: delegated to a serialization function.
 *     <b>Not overridable.</b></li>
 *   <li>All other types: unmodified.</li>
 * </ul>
 */
@SmithyUnstableApi
public class DocumentMemberSerVisitor implements ShapeVisitor<String> {
    protected boolean serdeElisionEnabled;
    private final GenerationContext context;
    private final String dataSource;
    private final Format defaultTimestampFormat;
    private final SerdeElisionIndex serdeElisionIndex;

    /**
     * Constructor.
     *
     * @param context The generation context.
     * @param dataSource The in-code location of the data to provide an input of
     *                   ({@code input.foo}, {@code entry}, etc.)
     * @param defaultTimestampFormat The default timestamp format used in absence
     *                               of a TimestampFormat trait.
     */
    public DocumentMemberSerVisitor(
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
     * traits, such as @xmlName. Can be, and defaults, to, null.
     */
    protected MemberShape getMemberShape() {
        return null;
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
     * Gets the in-code location of the data to provide an input of
     * ({@code input.foo}, {@code entry}, etc.).
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
        return "context.base64Encoder(" + dataSource + ")";
    }

    @Override
    public String booleanShape(BooleanShape shape) {
        return serializeUnmodified();
    }

    @Override
    public String byteShape(ByteShape shape) {
        return serializeUnmodified();
    }

    @Override
    public String shortShape(ShortShape shape) {
        return serializeUnmodified();
    }

    @Override
    public String integerShape(IntegerShape shape) {
        return serializeUnmodified();
    }

    @Override
    public String longShape(LongShape shape) {
        return serializeUnmodified();
    }

    @Override
    public String floatShape(FloatShape shape) {
        return handleFloat();
    }

    @Override
    public String doubleShape(DoubleShape shape) {
        return handleFloat();
    }

    private String handleFloat() {
        context.getWriter().addImport("serializeFloat", "__serializeFloat", TypeScriptDependency.AWS_SMITHY_CLIENT);
        return "__serializeFloat(" + dataSource + ")";
    }

    @Override
    public String stringShape(StringShape shape) {
        return HttpProtocolGeneratorUtils.getStringInputParam(context, shape, serializeUnmodified());
    }

    private String serializeUnmodified() {
        return dataSource;
    }

    @Override
    public String bigIntegerShape(BigIntegerShape shape) {
        return serializeFromBigJs();
    }

    @Override
    public String bigDecimalShape(BigDecimalShape shape) {
        return serializeFromBigJs();
    }

    private String serializeFromBigJs() {
        return dataSource + ".toJSON()";
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
        Format format = httpIndex.determineTimestampFormat(shape, Location.DOCUMENT, defaultTimestampFormat);
        return HttpProtocolGeneratorUtils.getTimestampInputParam(context, dataSource, shape, format);
    }

    @Override
    public final String documentShape(DocumentShape shape) {
        return getDelegateSerializer(shape);
    }

    @Override
    public final String listShape(ListShape shape) {
        return getDelegateSerializer(shape);
    }

    @Override
    public final String mapShape(MapShape shape) {
        return getDelegateSerializer(shape);
    }

    @Override
    public final String setShape(SetShape shape) {
        return getDelegateSerializer(shape);
    }

    @Override
    public final String structureShape(StructureShape shape) {
        return getDelegateSerializer(shape);
    }

    @Override
    public final String unionShape(UnionShape shape) {
        return getDelegateSerializer(shape);
    }

    private String getDelegateSerializer(Shape shape) {
        // Use the shape for the function name.
        Symbol symbol = context.getSymbolProvider().toSymbol(shape);

        if (serdeElisionEnabled && serdeElisionIndex.mayElide(shape)) {
            return "_json(" + dataSource + ")";
        }

        return ProtocolGenerator.getSerFunctionShortName(symbol)
                + "(" + dataSource + ", context)";
    }
}
