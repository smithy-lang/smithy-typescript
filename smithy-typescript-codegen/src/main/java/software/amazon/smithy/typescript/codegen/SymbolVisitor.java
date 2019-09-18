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

package software.amazon.smithy.typescript.codegen;

import static java.lang.String.format;
import static software.amazon.smithy.typescript.codegen.TypeScriptUtils.formatModuleName;

import java.util.logging.Logger;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
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
import software.amazon.smithy.model.traits.EnumTrait;
import software.amazon.smithy.model.traits.StreamingTrait;
import software.amazon.smithy.utils.StringUtils;

/**
 * This class is responsible for type mapping and file/identifier formatting.
 *
 * <p>Reserved words for TypeScript are automatically escaped so that they are
 * prefixed with "_". See "reserved-words.txt" for the list of words.
 */
final class SymbolVisitor implements SymbolProvider, ShapeVisitor<Symbol> {

    private static final Logger LOGGER = Logger.getLogger(SymbolVisitor.class.getName());

    private final Model model;

    SymbolVisitor(Model model) {
        this.model = model;
    }

    @Override
    public Symbol toSymbol(Shape shape) {
        Symbol symbol = shape.accept(this);
        LOGGER.fine(() -> "Creating symbol from " + shape + ": " + symbol);
        return symbol;
    }

    @Override
    public Symbol blobShape(BlobShape shape) {
        if (!shape.hasTrait(StreamingTrait.class)) {
            return createSymbol(shape, "Uint8Array");
        }

        return createSymbol(shape, "ArrayBuffer | ArrayBufferView | string | Readable | Blob");
    }

    @Override
    public Symbol booleanShape(BooleanShape shape) {
        return createSymbol(shape, "boolean");
    }

    @Override
    public Symbol listShape(ListShape shape) {
        Symbol reference = toSymbol(shape.getMember());
        return Symbol.builder()
                .name(format("Array<%s>", reference.getName()))
                .addReference(reference)
                .build();
    }

    @Override
    public Symbol setShape(SetShape shape) {
        Symbol reference = toSymbol(shape.getMember());
        return Symbol.builder()
                .name(format("Set<%s>", reference.getName()))
                .addReference(reference)
                .build();
    }

    /**
     * Maps get generated as an inline interface with a fixed value type.
     *
     * <p>For example:
     *
     * <pre>{@code
     * interface MyStructureShape {
     *   memberPointingToMap: {[key: string]: string};
     * }
     * }</pre>
     *
     * @inheritDoc
     */
    @Override
    public Symbol mapShape(MapShape shape) {
        Symbol reference = toSymbol(shape.getValue());
        return Symbol.builder()
                .name(format("{ [key: string]: %s }", reference.getName()))
                .addReference(reference)
                .build();
    }

    @Override
    public Symbol byteShape(ByteShape shape) {
        return createNumber(shape);
    }

    @Override
    public Symbol shortShape(ShortShape shape) {
        return createNumber(shape);
    }

    @Override
    public Symbol integerShape(IntegerShape shape) {
        return createNumber(shape);
    }

    @Override
    public Symbol longShape(LongShape shape) {
        return createNumber(shape);
    }

    @Override
    public Symbol floatShape(FloatShape shape) {
        return createNumber(shape);
    }

    @Override
    public Symbol doubleShape(DoubleShape shape) {
        return createNumber(shape);
    }

    private Symbol createNumber(Shape shape) {
        return createSymbol(shape, "number");
    }

    @Override
    public Symbol bigIntegerShape(BigIntegerShape shape) {
        return createSymbol(shape, "BigInt");
    }

    @Override
    public Symbol bigDecimalShape(BigDecimalShape shape) {
        return Symbol.builder()
                .name("Big")
                .namespace("@types/big.js", "/")
                .build();
    }

    @Override
    public Symbol documentShape(DocumentShape shape) {
        return Symbol.builder()
                .name("DocumentType.Value")
                .namespace("@smithy/core", "/")
                .build();
    }

    @Override
    public Symbol operationShape(OperationShape shape) {
        String commandName = StringUtils.capitalize(shape.getId().getName()) + "Command";
        return createSymbol(shape, commandName, formatModuleName(shape));
    }

    @Override
    public Symbol stringShape(StringShape shape) {
        // Enums that provide a name for each variant create an actual enum type.
        return shape.getTrait(EnumTrait.class)
                .map(enumTrait -> createEnumSymbol(shape, enumTrait))
                .orElseGet(() -> createSymbol(shape, "string"));
    }

    private Symbol createEnumSymbol(StringShape shape, EnumTrait enumTrait) {
        Symbol stringSymbol = enumTrait.hasNames()
                ? createObjectSymbol(shape)
                : createSymbol(shape, "string");
        return stringSymbol.toBuilder()
                .putProperty(EnumTrait.class.getName(), enumTrait)
                .build();
    }

    @Override
    public Symbol resourceShape(ResourceShape shape) {
        return createObjectSymbol(shape);
    }

    @Override
    public Symbol serviceShape(ServiceShape shape) {
        return createObjectSymbol(shape);
    }

    @Override
    public Symbol structureShape(StructureShape shape) {
        return createObjectSymbol(shape);
    }

    @Override
    public Symbol unionShape(UnionShape shape) {
        return createObjectSymbol(shape);
    }

    @Override
    public Symbol memberShape(MemberShape shape) {
        Shape targetShape = model.getShapeIndex().getShape(shape.getTarget())
                .orElseThrow(() -> new CodegenException("Shape not found: " + shape.getTarget()));
        Symbol targetSymbol = targetShape.accept(this);

        if (targetSymbol.getProperties().containsKey(EnumTrait.class.getName())) {
            return createMemberSymbolWithEnumTarget(targetSymbol);
        }

        return targetSymbol;
    }

    private Symbol createMemberSymbolWithEnumTarget(Symbol targetSymbol) {
        EnumTrait trait = targetSymbol.getProperty(EnumTrait.class.getName(), EnumTrait.class)
                .orElseThrow(IllegalStateException::new);
        // Clear out the namespace to prevent any kind of import.
        Symbol.Builder builder = targetSymbol.toBuilder().namespace(null, "/");

        // Enum traits with names become an exported union of string literals.
        if (trait.hasNames()) {
            builder.name(targetSymbol.getName() + " | string").addReference(targetSymbol);
        } else {
            builder.name(TypeScriptUtils.getEnumVariants(trait.getValues().keySet()) + " | string");
        }

        return builder.build();
    }

    @Override
    public Symbol timestampShape(TimestampShape shape) {
        return createSymbol(shape, "Date");
    }

    private static Symbol createObjectSymbol(Shape shape) {
        String name = StringUtils.capitalize(shape.getId().getName());
        return createSymbol(shape, name, formatModuleName(shape));
    }

    private static Symbol createSymbol(Shape shape, String typeName) {
        return createSymbol(shape, typeName, null);
    }

    private static Symbol createSymbol(Shape shape, String typeName, String namespace) {
        return Symbol.builder()
                .name(typeName)
                .namespace(namespace, "/")
                .definitionFile(toFilename(shape, typeName, namespace))
                .build();
    }

    private static String toFilename(Shape shape, String name, String namespace) {
        if (shape.isServiceShape()) {
            return format("%sClient.ts", name);
        }

        String filename;
        if (namespace == null) {
            filename = name;
        } else {
            StringBuilder builder = new StringBuilder();
            String[] parts = namespace.split("/");
            for (String part : parts) {
                builder.append('/').append(part);
            }
            filename = builder.toString();
        }

        return format("types/%s.ts", filename).replace("//", "/");
    }
}
