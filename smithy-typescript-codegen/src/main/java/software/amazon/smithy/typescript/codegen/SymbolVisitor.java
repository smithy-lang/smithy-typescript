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

import java.util.HashSet;
import java.util.Set;
import java.util.logging.Logger;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.ReservedWordSymbolProvider;
import software.amazon.smithy.codegen.core.ReservedWords;
import software.amazon.smithy.codegen.core.ReservedWordsBuilder;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.OperationIndex;
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
import software.amazon.smithy.model.shapes.ShapeType;
import software.amazon.smithy.model.shapes.ShapeVisitor;
import software.amazon.smithy.model.shapes.ShortShape;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.shapes.ToShapeId;
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

    static final String IMPLEMENTS_INTERFACE_PROPERTY = "implementsInterface";
    private static final Logger LOGGER = Logger.getLogger(SymbolVisitor.class.getName());

    private final Model model;
    private final ReservedWordSymbolProvider.Escaper escaper;
    private final Set<StructureShape> outputShapes = new HashSet<>();

    SymbolVisitor(Model model) {
        this.model = model;

        // Load reserved words from a new-line delimited file.
        ReservedWords reservedWords = new ReservedWordsBuilder()
                .loadWords(TypeScriptCodegenPlugin.class.getResource("reserved-words.txt"))
                .build();

        escaper = ReservedWordSymbolProvider.builder()
                .nameReservedWords(reservedWords)
                // Only escape words when the symbol has a definition file to
                // prevent escaping intentional references to built-in types.
                .escapePredicate((shape, symbol) -> !StringUtils.isEmpty(symbol.getDefinitionFile()))
                .buildEscaper();

        // Get each structure that's used as output or errors.
        OperationIndex operationIndex = model.getKnowledge(OperationIndex.class);
        model.shapes(OperationShape.class).forEach(operationShape -> {
            operationIndex.getOutput(operationShape).ifPresent(outputShapes::add);
            outputShapes.addAll(operationIndex.getErrors(operationShape));
        });
    }

    @Override
    public Symbol toSymbol(Shape shape) {
        Symbol symbol = shape.accept(this);
        LOGGER.fine(() -> "Creating symbol from " + shape + ": " + symbol);
        return escaper.escapeSymbol(shape, symbol);
    }

    @Override
    public String toMemberName(MemberShape shape) {
        return escaper.escapeMemberName(shape.getMemberName());
    }

    @Override
    public Symbol blobShape(BlobShape shape) {
        if (!shape.hasTrait(StreamingTrait.class)) {
            return createSymbolBuilder(shape, "Uint8Array").build();
        }

        // Note: `Readable` needs an import and a dependency.
        return createSymbolBuilder(shape, "ArrayBuffer | ArrayBufferView | string | Readable | Blob", null)
                .addReference(Symbol.builder().name("Readable").namespace("stream", "/").build())
                .build();
    }

    @Override
    public Symbol booleanShape(BooleanShape shape) {
        return createSymbolBuilder(shape, "boolean").build();
    }

    @Override
    public Symbol listShape(ListShape shape) {
        Symbol reference = toSymbol(shape.getMember());
        return createSymbolBuilder(shape, format("Array<%s>", reference.getName()), null)
                .addReference(reference)
                .build();
    }

    @Override
    public Symbol setShape(SetShape shape) {
        Symbol reference = toSymbol(shape.getMember());
        return createSymbolBuilder(shape, format("Set<%s>", reference.getName()), null)
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
        return createSymbolBuilder(shape, format("{ [key: string]: %s }", reference.getName()), null)
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
        return createSymbolBuilder(shape, "number").build();
    }

    @Override
    public Symbol bigIntegerShape(BigIntegerShape shape) {
        // BigInt is not supported across all environments, use big.js instead.
        return createBigJsSymbol(shape);
    }

    @Override
    public Symbol bigDecimalShape(BigDecimalShape shape) {
        return createBigJsSymbol(shape);
    }

    private Symbol createBigJsSymbol(Shape shape) {
        return createSymbolBuilder(shape, "Big", TypeScriptDependency.TYPES_BIG_JS.packageName)
                .addDependency(TypeScriptDependency.TYPES_BIG_JS)
                .addDependency(TypeScriptDependency.BIG_JS)
                .build();
    }

    @Override
    public Symbol documentShape(DocumentShape shape) {
        return addSmithyImport(createSymbolBuilder(shape, "_smithy.DocumentType.Value")).build();
    }

    @Override
    public Symbol operationShape(OperationShape shape) {
        String commandName = flattenShapeName(shape) + "Command";
        String moduleName = formatModuleName(shape.getType(), commandName);
        Symbol intermediate = createGeneratedSymbolBuilder(shape, commandName, moduleName).build();
        Symbol.Builder builder = intermediate.toBuilder();
        // Add input and output type symbols (XCommandInput / XCommandOutput).
        builder.putProperty("inputType", intermediate.toBuilder().name(commandName + "Input").build());
        builder.putProperty("outputType", intermediate.toBuilder().name(commandName + "Output").build());
        return builder.build();
    }

    @Override
    public Symbol stringShape(StringShape shape) {
        // Enums that provide a name for each variant create an actual enum type.
        return shape.getTrait(EnumTrait.class)
                .map(enumTrait -> createEnumSymbol(shape, enumTrait))
                .orElseGet(() -> createSymbolBuilder(shape, "string").build());
    }

    private Symbol createEnumSymbol(StringShape shape, EnumTrait enumTrait) {
        return createObjectSymbolBuilder(shape)
                .putProperty(EnumTrait.class.getName(), enumTrait)
                .build();
    }

    @Override
    public Symbol resourceShape(ResourceShape shape) {
        return createObjectSymbolBuilder(shape).build();
    }

    @Override
    public Symbol serviceShape(ServiceShape shape) {
        String name = StringUtils.capitalize(shape.getId().getName()) + "Client";
        String moduleName = formatModuleName(shape.getType(), name);
        return createGeneratedSymbolBuilder(shape, name, moduleName).build();
    }

    @Override
    public Symbol structureShape(StructureShape shape) {
        Symbol.Builder builder = createObjectSymbolBuilder(shape);
        addSmithyImport(builder);

        if (outputShapes.contains(shape)) {
            SymbolReference reference = SymbolReference.builder()
                    .options(SymbolReference.ContextOption.DECLARE)
                    .alias("$MetadataBearer")
                    .symbol(TypeScriptDependency.AWS_SDK_TYPES.createSymbol("MetadataBearer"))
                    .putProperty(IMPLEMENTS_INTERFACE_PROPERTY, true)
                    .build();
            builder.addReference(reference);
            builder.putProperty("isOutput", true);
        }

        return builder.build();
    }

    private Symbol.Builder addSmithyImport(Symbol.Builder builder) {
        Symbol importSymbol = Symbol.builder()
                .name("*")
                .namespace("@aws-sdk/smithy-client", "/")
                .build();
        SymbolReference reference = SymbolReference.builder()
                .symbol(importSymbol)
                .alias("_smithy")
                .options(SymbolReference.ContextOption.DECLARE)
                .build();
        return builder.addReference(reference);
    }

    @Override
    public Symbol unionShape(UnionShape shape) {
        return createObjectSymbolBuilder(shape).build();
    }

    @Override
    public Symbol memberShape(MemberShape shape) {
        Shape targetShape = model.getShape(shape.getTarget())
                .orElseThrow(() -> new CodegenException("Shape not found: " + shape.getTarget()));
        Symbol targetSymbol = toSymbol(targetShape);

        if (targetSymbol.getProperties().containsKey(EnumTrait.class.getName())) {
            return createMemberSymbolWithEnumTarget(targetSymbol);
        }

        return targetSymbol;
    }

    private Symbol createMemberSymbolWithEnumTarget(Symbol targetSymbol) {
        return targetSymbol.toBuilder()
                .namespace(null, "/")
                .name(targetSymbol.getName() + " | string")
                .addReference(targetSymbol)
                .build();
    }

    @Override
    public Symbol timestampShape(TimestampShape shape) {
        return createSymbolBuilder(shape, "Date").build();
    }

    private String flattenShapeName(ToShapeId id) {
        return StringUtils.capitalize(id.toShapeId().getName());
    }

    private Symbol.Builder createObjectSymbolBuilder(Shape shape) {
        String name = flattenShapeName(shape);
        String moduleName = formatModuleName(shape.getType(), name);
        return createGeneratedSymbolBuilder(shape, name, moduleName);
    }

    private Symbol.Builder createSymbolBuilder(Shape shape, String typeName) {
        return Symbol.builder().putProperty("shape", shape).name(typeName);
    }

    private Symbol.Builder createSymbolBuilder(Shape shape, String typeName, String namespace) {
        return Symbol.builder()
                .putProperty("shape", shape)
                .name(typeName)
                .namespace(namespace, "/");
    }

    private Symbol.Builder createGeneratedSymbolBuilder(Shape shape, String typeName, String namespace) {
        return createSymbolBuilder(shape, typeName, namespace)
                .definitionFile(toFilename(namespace));
    }

    private String formatModuleName(ShapeType shapeType, String name) {
        // All shapes except for the service and operations are stored in models.
        if (shapeType == ShapeType.SERVICE) {
            return "./" + name;
        } else if (shapeType == ShapeType.OPERATION) {
            return "./commands/" + name;
        } else {
            return "./models/index";
        }
    }

    private String toFilename(String namespace) {
        return namespace + ".ts";
    }
}
