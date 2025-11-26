/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.schema;

import java.nio.file.Paths;
import java.util.HashSet;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.codegen.core.ReservedWords;
import software.amazon.smithy.codegen.core.ReservedWordsBuilder;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.ShapeType;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.model.traits.StreamingTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.typescript.codegen.CodegenUtils;
import software.amazon.smithy.typescript.codegen.TypeScriptClientCodegenPlugin;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.util.StringStore;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generates schema objects used to define shape (de)serialization.
 */
@SmithyInternalApi
public class SchemaGenerator implements Runnable {
    public static final String SCHEMAS_FOLDER = "schemas";
    private final SchemaReferenceIndex elision;
    private final TypeScriptSettings settings;
    private final SymbolProvider symbolProvider;
    private final Model model;
    private final FileManifest fileManifest;
    private final StringStore store = new StringStore();
    private final TypeScriptWriter writer = new TypeScriptWriter("");

    /**
     * Avoids infinite recursion when navigating shape graph.
     */
    private final Set<String> loadShapesVisited = new HashSet<>();

    private final Set<StructureShape> structureShapes = new TreeSet<>();
    private final Set<CollectionShape> collectionShapes = new TreeSet<>();
    private final Set<MapShape> mapShapes = new TreeSet<>();
    private final Set<UnionShape> unionShapes = new TreeSet<>();
    private final Set<OperationShape> operationShapes = new TreeSet<>();
    private final Set<Shape> simpleShapes = new TreeSet<>();

    /**
     * Used to deconflict schema variable names.
     */
    private final Set<Shape> existsAsSchema = new HashSet<>();
    private final Set<Shape> requiresNamingDeconfliction = new HashSet<>();

    private final ReservedWords reservedWords = new ReservedWordsBuilder()
        .loadWords(Objects.requireNonNull(TypeScriptClientCodegenPlugin.class.getResource("reserved-words.txt")))
        .build();

    public SchemaGenerator(Model model,
                           FileManifest fileManifest,
                           TypeScriptSettings settings, SymbolProvider symbolProvider) {
        this.model = model;
        this.fileManifest = fileManifest;
        elision = SchemaReferenceIndex.of(model);
        this.settings = settings;
        this.symbolProvider = symbolProvider;
        writer.write("""
        /* eslint no-var: 0 */""");
    }

    /**
     * Writes all schemas for the model to a schemas.ts file.
     */
    @Override
    public void run() {
        for (ServiceShape service : model.getServiceShapes()) {
            if (!SchemaGenerationAllowlist.allows(service.getId(), settings)) {
                return;
            }
            for (OperationShape operation : TopDownIndex.of(model).getContainedOperations(service)) {
                if (operation.getInput().isPresent()) {
                    loadShapes(model.expectShape(operation.getInput().get()));
                } else {
                    loadShapes(model.expectShape(ShapeId.from("smithy.api#Unit")));
                }
                if (operation.getOutput().isPresent()) {
                    loadShapes(model.expectShape(operation.getOutput().get()));
                } else {
                    loadShapes(model.expectShape(ShapeId.from("smithy.api#Unit")));
                }
                operation.getErrors().forEach(error -> {
                    loadShapes(model.expectShape(error));
                });
                operationShapes.add(operation);
                existsAsSchema.add(operation);
            }
        }
        deconflictSchemaVarNames();

        simpleShapes.forEach(this::writeSimpleSchema);
        structureShapes.forEach(this::writeStructureSchema);
        writeBaseError();
        collectionShapes.forEach(this::writeListSchema);
        mapShapes.forEach(this::writeMapSchema);
        unionShapes.forEach(this::writeUnionSchema);
        operationShapes.forEach(this::writeOperationSchema);

        String stringConstants = store.flushVariableDeclarationCode();

        boolean hasContent = !writer.toString().matches("/\\* eslint no-var: 0 \\*/[\\s\\n]+$");
        if (hasContent) {
            fileManifest.writeFile(
                Paths.get(CodegenUtils.SOURCE_FOLDER, SCHEMAS_FOLDER,  "schemas_0.ts").toString(),
                stringConstants + "\n" + writer
            );
        }
    }

    /**
     * Identifies repeated strings among the schemas to use in StringStore.
     */
    private void loadShapes(Shape shape) {
        String absoluteName = shape.getId().toString();

        if (shape.isMemberShape()) {
            loadShapes(model.expectShape(shape.asMemberShape().get().getTarget()));
            return;
        }

        if (loadShapesVisited.contains(absoluteName)) {
            return;
        }

        loadShapesVisited.add(absoluteName);

        switch (shape.getType()) {
            case LIST -> {
                collectionShapes.add(shape.asListShape().get());
                existsAsSchema.add(shape);
            }
            case SET -> {
                collectionShapes.add(shape.asSetShape().get());
                existsAsSchema.add(shape);
            }
            case MAP -> {
                mapShapes.add(shape.asMapShape().get());
                existsAsSchema.add(shape);
            }
            case STRUCTURE -> {
                structureShapes.add(shape.asStructureShape().get());
                existsAsSchema.add(shape);
            }
            case UNION -> {
                unionShapes.add(shape.asUnionShape().get());
                existsAsSchema.add(shape);
            }
            case BYTE, INT_ENUM, SHORT, INTEGER, LONG, FLOAT, DOUBLE, BIG_INTEGER, BIG_DECIMAL, BOOLEAN, STRING,
                 TIMESTAMP, DOCUMENT, ENUM, BLOB -> {
                if (elision.traits.hasSchemaTraits(shape)) {
                    existsAsSchema.add(shape);
                }
                simpleShapes.add(shape);
            }
            default -> {
                // ...
            }
        }

        Set<Shape> memberTargetShapes = shape.getAllMembers().values().stream()
            .map(MemberShape::getTarget)
            .map(model::expectShape)
            .collect(Collectors.toSet());

        for (Shape memberTargetShape : memberTargetShapes) {
            loadShapes(memberTargetShape);
        }
    }

    /**
     * Since we use the short names for schema objects, in rare cases there may be a
     * naming conflict due to shapes with the same short name in different namespaces.
     * These shapes will have their variable names deconflicted with a suffix.
     */
    private void deconflictSchemaVarNames() {
        Set<String> observedShapeNames = new HashSet<>();
        for (Shape shape : existsAsSchema) {
            if (observedShapeNames.contains(shape.getId().getName())) {
                requiresNamingDeconfliction.add(shape);
            } else {
                observedShapeNames.add(shape.getId().getName());
            }
        }
    }

    /**
     * @return variable name of the shape's schema, with deconfliction for multiple namespaces with the same
     * unqualified name.
     */
    private String getShapeVariableName(Shape shape) {
        if (shape.getId().equals(ShapeId.from("smithy.api#Unit"))) {
            return "__Unit";
        }
        String symbolName = reservedWords.escape(shape.getId().getName());
        if (requiresNamingDeconfliction.contains(shape)) {
            symbolName += "_" + store.var(shape.getId().getNamespace(), "n");
        }
        return symbolName;
    }

    /**
     * Writes the schema declaration for a simple shape.
     * If it has no runtime traits, e.g. a plain string, nothing will be written.
     */
    private void writeSimpleSchema(Shape shape) {
        if (elision.traits.hasSchemaTraits(shape)) {
            writer.addTypeImport("StaticSimpleSchema", null, TypeScriptDependency.SMITHY_TYPES);
            writer.openBlock("""
                    export var $L: StaticSimpleSchema = [0, $L, $L,""",
                "",
                getShapeVariableName(shape),
                store.var(shape.getId().getNamespace(), "n"),
                store.var(shape.getId().getName()),
                () -> {
                    writeTraits(shape);
                    writer.writeInline(", $L];", resolveSimpleSchema(shape, shape));
                }
            );
        }
    }

    private void writeStructureSchema(StructureShape shape) {
        checkedWriteSchema(shape, () -> {
            String symbolName = reservedWords.escape(shape.getId().getName());
            if (shape.hasTrait(ErrorTrait.class)) {
                String exceptionCtorSymbolName = "__" + symbolName;
                writer.addTypeImport("StaticErrorSchema", null, TypeScriptDependency.SMITHY_TYPES);
                writer.addRelativeImport(
                    symbolName,
                    exceptionCtorSymbolName,
                    Paths.get("..", "models", "errors")
                );
                writer.openBlock("""
                export var $L: StaticErrorSchema = [-3, $L, $L,""",
                    "];",
                    getShapeVariableName(shape),
                    store.var(shape.getId().getNamespace(), "n"),
                    store.var(shape.getId().getName()),
                    () -> doWithMembers(shape)
                );
                writer.addImportSubmodule("TypeRegistry", null, TypeScriptDependency.SMITHY_CORE, "/schema");
                writer.write("""
                    TypeRegistry.for($L).registerError($L, $L);""",
                    store.var(shape.getId().getNamespace(), "n"),
                    getShapeVariableName(shape),
                    exceptionCtorSymbolName
                );
            } else {
                writer.addTypeImport("StaticStructureSchema", null, TypeScriptDependency.SMITHY_TYPES);
                writer.openBlock("""
                export var $L: StaticStructureSchema = [3, $L, $L,""",
                    "];",
                    getShapeVariableName(shape),
                    store.var(shape.getId().getNamespace(), "n"),
                    store.var(shape.getId().getName()),
                    () -> doWithMembers(shape)
                );
            }
        });
    }

    /**
     * Writes the synthetic base exception schema.
     */
    private void writeBaseError() {
        String serviceName = CodegenUtils.getServiceName(settings, model, symbolProvider);
        String serviceExceptionName = CodegenUtils.getSyntheticBaseExceptionName(
            serviceName, model
        );

        String namespace = settings.getService(model).getId().getNamespace();

        String exceptionCtorSymbolName = "__" + serviceExceptionName;
        writer.addTypeImport("StaticErrorSchema", null, TypeScriptDependency.SMITHY_TYPES);
        writer.addRelativeImport(
            serviceExceptionName,
            exceptionCtorSymbolName,
            Paths.get("..", "models", serviceExceptionName)
        );

        String syntheticNamespace = store.var("smithy.ts.sdk.synthetic." + namespace);
        writer.write("""
                export var $L: StaticErrorSchema = [-3, $L, $S, 0, [], []];""",
            serviceExceptionName,
            syntheticNamespace,
            serviceExceptionName
        );
        writer.addImportSubmodule("TypeRegistry", null, TypeScriptDependency.SMITHY_CORE, "/schema");
        writer.write("""
            TypeRegistry.for($L).registerError($L, $L);""",
            syntheticNamespace,
            serviceExceptionName,
            exceptionCtorSymbolName
        );
    }

    private void writeUnionSchema(UnionShape shape) {
        checkedWriteSchema(shape, () -> {
            writer.addTypeImport("StaticStructureSchema", null, TypeScriptDependency.SMITHY_TYPES);
            writer.openBlock("""
                    export var $L: StaticStructureSchema = [3, $L, $L,""",
                "];",
                getShapeVariableName(shape),
                store.var(shape.getId().getNamespace(), "n"),
                store.var(shape.getId().getName()),
                () -> doWithMembers(shape)
            );
        });
    }

    /**
     * Handles the member entries for unions/structures.
     */
    private void doWithMembers(Shape shape) {
        writeTraits(shape);

        // member names.
        writer.write(",");
        writer.writeInline("[");
        shape.getAllMembers().forEach((memberName, member) -> {
            writer.writeInline("$L, ", store.var(memberName));
        });
        writer.unwrite(", ");
        writer.write("],");

        // member schemas.
        writer.writeInline("[");
        shape.getAllMembers().forEach((memberName, member) -> {
            String ref = resolveSchema(shape, member);
            if (elision.traits.hasSchemaTraits(member)) {
                writer.writeInline("[$L, ", ref);
                writeTraits(member);
                writer.writeInline("], ");
            } else {
                writer.writeInline("$L, ", ref);
            }
        });
        writer.unwrite(", ");
        writer.write("]");
    }

    private void writeListSchema(CollectionShape shape) {
        checkedWriteSchema(shape, () -> {
            writer.addTypeImport("StaticListSchema", null, TypeScriptDependency.SMITHY_TYPES);
            writer.openBlock("""
                    export var $L: StaticListSchema = [1, $L, $L,""",
                "];",
                getShapeVariableName(shape),
                store.var(shape.getId().getNamespace(), "n"),
                store.var(shape.getId().getName()),
                () -> this.doWithMember(
                    shape,
                    shape.getMember()
                )
            );
        });
    }

    private void writeMapSchema(MapShape shape) {
        checkedWriteSchema(shape, () -> {
            writer.addTypeImport("StaticMapSchema", null, TypeScriptDependency.SMITHY_TYPES);
            writer.openBlock("""
                    export var $L: StaticMapSchema = [2, $L, $L,""",
                "];",
                getShapeVariableName(shape),
                store.var(shape.getId().getNamespace(), "n"),
                store.var(shape.getId().getName()),
                () -> this.doWithMember(
                    shape,
                    shape.getKey(),
                    shape.getValue()
                )
            );
        });
    }

    /**
     * Write member schema insertion for lists.
     */
    private void doWithMember(Shape shape, MemberShape memberShape) {
        writeTraits(shape);
        String ref = resolveSchema(shape, memberShape);
        if (elision.traits.hasSchemaTraits(memberShape)) {
            writer.openBlock(
                ", [$L, ",
                "]",
                ref,
                () -> {
                    writeTraits(memberShape);
                }
            );
        } else {
            writer.write(", $L", ref);
        }
    }

    /**
     * Write member schema insertion for maps.
     */
    private void doWithMember(Shape shape, MemberShape keyShape, MemberShape memberShape) {
        writeTraits(shape);
        String keyRef = resolveSchema(shape, keyShape);
        String valueRef = resolveSchema(shape, memberShape);
        if (elision.traits.hasSchemaTraits(memberShape) || elision.traits.hasSchemaTraits(keyShape)) {
            writer.openBlock(
                ", [$L, ",
                "]",
                keyRef,
                () -> {
                    writeTraits(keyShape);
                }
            );
            writer.openBlock(
                ", [$L, ",
                "]",
                valueRef,
                () -> {
                    writeTraits(memberShape);
                }
            );
        } else {
            writer.write(", $L, $L", keyRef, valueRef);
        }
    }

    private void writeOperationSchema(OperationShape shape) {
        writer.addTypeImport("StaticOperationSchema", null, TypeScriptDependency.SMITHY_TYPES);
        writer.openBlock("""
            export var $L: StaticOperationSchema = [9, $L, $L,""",
            "];",
            getShapeVariableName(shape),
            store.var(shape.getId().getNamespace(), "n"),
            store.var(shape.getId().getName()),
            () -> {
                writeTraits(shape);
                writer.write("""
                    , () => $L, () => $L""",
                    getShapeVariableName(model.expectShape(shape.getInputShape())),
                    getShapeVariableName(model.expectShape(shape.getOutputShape()))
                );
            }
        );
    }

    private void writeTraits(Shape shape) {
        String traitCode = new SchemaTraitWriter(
            shape, elision,
            store
        ).toString();

        writer.writeInline(traitCode.replace("$", "$$"));
    }

    /**
     * Checks whether ok to write minimized schema.
     */
    private void checkedWriteSchema(Shape shape, Runnable schemaWriteFn) {
        if (shape.getId().getNamespace().equals("smithy.api")
            && shape.getId().getName().equals("Unit")) {
            // special signal value for operation input/output.
            writer.write("""
                export var __Unit = "unit" as const;""");
        } else if (!elision.isReferenceSchema(shape) && !elision.traits.hasSchemaTraits(shape)) {
            String sentinel = this.resolveSchema(model.expectShape(ShapeId.from("smithy.api#Unit")), shape);

            writer.write(
                """
                export var $L = $L;""",
                getShapeVariableName(shape),
                sentinel
            );
        } else {
            schemaWriteFn.run();
        }
    }

    /**
     * @return generally the symbol name of the target shape, but sometimes a sentinel value for special types like
     * blob and timestamp.
     */
    private String resolveSchema(Shape context, Shape shape) {
        MemberShape memberShape = null;
        if (shape instanceof MemberShape ms) {
            memberShape = ms;
            shape = model.expectShape(memberShape.getTarget());
        }

        boolean isReference = elision.isReferenceSchema(shape);
        boolean hasTraits = elision.traits.hasSchemaTraits(shape);

        if (!hasTraits) {
            try {
                return resolveSimpleSchema(context, memberShape != null ? memberShape : shape);
            } catch (IllegalArgumentException ignored) {
                //
            }
        }

        return (isReference || hasTraits ? "() => " : "") + getShapeVariableName(shape);
    }

    /**
     * @return a sentinel value representing a preconfigured schema type.
     * @throws IllegalArgumentException when no sentinel value exists, e.g. a non-simple schema was passed in.
     */
    private String resolveSimpleSchema(Shape context, Shape shape) {
        MemberShape memberShape = null;
        if (shape instanceof MemberShape ms) {
            memberShape = ms;
            shape = model.expectShape(memberShape.getTarget());
        }

        ShapeType type = shape.getType();

        switch (type) {
            case BOOLEAN -> {
                return "2";
            }
            case STRING, ENUM -> {
                return "0";
            }
            case TIMESTAMP -> {
                Optional<TimestampFormatTrait> trait = shape.getTrait(TimestampFormatTrait.class);
                if (memberShape != null && memberShape.hasTrait(TimestampFormatTrait.class)) {
                    trait = memberShape.getTrait(TimestampFormatTrait.class);
                }
                return trait.map(timestampFormatTrait -> switch (timestampFormatTrait.getValue()) {
                    case "date-time" -> "5";
                    case "http-date" -> "6";
                    case "epoch-seconds" -> "7";
                    default -> "4";
                }).orElse("4");
            }
            case BLOB -> {
                if (shape.hasTrait(StreamingTrait.class)) {
                    return "42";
                }
                return "21";
            }
            case BYTE, SHORT, INTEGER, INT_ENUM, LONG, FLOAT, DOUBLE -> {
                return "1";
            }
            case DOCUMENT -> {
                return "15";
            }
            case BIG_DECIMAL -> {
                return "17";
            }
            case BIG_INTEGER -> {
                return "19";
            }
            case LIST, SET, MAP -> {
                return resolveSimpleSchemaNestedContainer(context, shape);
            }
            default -> {
                //
            }
        }
        throw new IllegalArgumentException("shape is not simple");
    }

    /**
     * For example, the number 5 represents a timestamp (Date-Time) schema with no other traits.
     * For lists, the bit modifier 64 is applied, giving 64 | 5 for a list of timestamps.
     * For further nested containers, bit masks can no longer be used, necessitating the `sim` simple schema
     * wrapper: `sim("namespace", "ListOfLists", 64 | 5, {});`.
     *
     * @return the container bit modifier attached to the schema numeric value.
     */
    private String resolveSimpleSchemaNestedContainer(Shape context, Shape shape) {
        Shape contained;
        String staticTypePrefix;
        String sentinel;
        String keySchema = "";
        switch (shape.getType()) {
            case LIST -> {
                contained = shape.asListShape().get().getMember();
                staticTypePrefix = "[1, ";
                sentinel = "64";
                writer.addTypeImport("StaticListSchema", null, TypeScriptDependency.SMITHY_TYPES);
            }
            case MAP -> {
                contained = shape.asMapShape().get().getValue();
                staticTypePrefix = "[2, ";
                keySchema = this.resolveSimpleSchema(context, shape.asMapShape().get().getKey()) + ", ";
                sentinel = "128";
                writer.addTypeImport("StaticMapSchema", null, TypeScriptDependency.SMITHY_TYPES);
            }
            default -> {
                throw new IllegalArgumentException(
                    "call to resolveSimpleSchemaNestedContainer with incompatible shape type."
                );
            }
        }
        if (contained.isMemberShape()) {
            contained = model.expectShape(contained.asMemberShape().get().getTarget());
        }

        if (contained.isListShape() || contained.isMapShape()) {
            String schemaVarName = store.var(shape.getId().getName());
            return staticTypePrefix
                + store.var(shape.getId().getNamespace(), "n") + ", " + schemaVarName + ", 0, "
                + keySchema
                + this.resolveSimpleSchema(context, contained) + "]";
        } else {
            return sentinel + " | " + this.resolveSimpleSchema(context, contained);
        }
    }
}
