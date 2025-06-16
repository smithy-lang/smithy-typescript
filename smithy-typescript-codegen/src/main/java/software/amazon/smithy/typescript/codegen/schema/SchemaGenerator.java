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
    private final StringStore stringStore = new StringStore();
    private final TypeScriptWriter writer = new TypeScriptWriter("");

    private final Set<String> loadShapesVisited = new HashSet<>();

    private final Set<StructureShape> structureShapes = new TreeSet<>();
    private final Set<CollectionShape> collectionShapes = new TreeSet<>();
    private final Set<MapShape> mapShapes = new TreeSet<>();
    private final Set<UnionShape> unionShapes = new TreeSet<>();
    private final Set<OperationShape> operationShapes = new TreeSet<>();
    private final Set<Shape> simpleShapes = new TreeSet<>();

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
        writer.write(
            """
            /* eslint no-var: 0 */
            """
        );
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
                operation.getInput().ifPresent(inputShape -> {
                    loadShapes(model.expectShape(inputShape));
                });
                operation.getOutput().ifPresent(outputShape -> {
                    loadShapes(model.expectShape(outputShape));
                });
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

        String stringVariables = stringStore.flushVariableDeclarationCode();
        fileManifest.writeFile(
            Paths.get(CodegenUtils.SOURCE_FOLDER, SCHEMAS_FOLDER,  "schemas.ts").toString(),
            stringVariables + "\n" + writer
        );
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
        String symbolName = reservedWords.escape(shape.getId().getName());
        if (requiresNamingDeconfliction.contains(shape)) {
            symbolName += "_" + stringStore.var(shape.getId().getNamespace(), "n");
        }
        return symbolName;
    }

    private void writeSimpleSchema(Shape shape) {
        if (elision.traits.hasSchemaTraits(shape)) {
            writer.addImportSubmodule("sim", "sim", TypeScriptDependency.SMITHY_CORE, "/schema");
            writer.write("""
                    export var $L = sim($L, $L, $L,""",
                getShapeVariableName(shape),
                stringStore.var(shape.getId().getNamespace(), "n"),
                stringStore.var(shape.getId().getName()),
                resolveSimpleSchema(shape)
            );
            writeTraits(shape);
            writer.write(");");
        }
    }

    private void writeStructureSchema(StructureShape shape) {
        checkedWriteSchema(shape, () -> {
            String symbolName = reservedWords.escape(shape.getId().getName());
            if (shape.hasTrait(ErrorTrait.class)) {
                String exceptionCtorSymbolName = "__" + symbolName;
                writer.addImportSubmodule("error", "error", TypeScriptDependency.SMITHY_CORE, "/schema");
                writer.addRelativeImport(
                    symbolName,
                    exceptionCtorSymbolName,
                    Paths.get("..", "models", "index")
                );
                writer.openBlock("""
                export var $L = error($L, $L,""",
                    "",
                    getShapeVariableName(shape),
                    stringStore.var(shape.getId().getNamespace(), "n"),
                    stringStore.var(shape.getId().getName()),
                    () -> doWithMembers(shape)
                );
                writer.writeInline(",$L", exceptionCtorSymbolName);
                writer.write(");");
            } else {
                writer.addImportSubmodule("struct", "struct", TypeScriptDependency.SMITHY_CORE, "/schema");
                writer.openBlock("""
                export var $L = struct($L, $L,""",
                    ");",
                    getShapeVariableName(shape),
                    stringStore.var(shape.getId().getNamespace(), "n"),
                    stringStore.var(shape.getId().getName()),
                    () -> doWithMembers(shape)
                );
            }
        });
    }

    private void writeBaseError() {
        String serviceName = CodegenUtils.getServiceName(settings, model, symbolProvider);
        String serviceExceptionName = CodegenUtils.getServiceExceptionName(serviceName);
        String namespace = model.getServiceShapes().stream().findFirst().get().getId().getNamespace();

        String exceptionCtorSymbolName = "__" + serviceExceptionName;
        writer.addImportSubmodule("error", "error", TypeScriptDependency.SMITHY_CORE, "/schema");
        writer.addRelativeImport(
            serviceExceptionName,
            exceptionCtorSymbolName,
            Paths.get("..", "models", serviceExceptionName)
        );
        writer.write("""
                export var $L = error($S, $S, 0, [], []""",
            serviceExceptionName,
            "smithy.ts.sdk.synthetic." + namespace,
            serviceExceptionName
        );
        writer.writeInline(",$L", exceptionCtorSymbolName);
        writer.write(");");
    }

    private void writeUnionSchema(UnionShape shape) {
        checkedWriteSchema(shape, () -> {
            writer.addImportSubmodule("struct", "uni", TypeScriptDependency.SMITHY_CORE, "/schema");
            writer.openBlock("""
                    export var $L = uni($L, $L,""",
                ");",
                getShapeVariableName(shape),
                stringStore.var(shape.getId().getNamespace(), "n"),
                stringStore.var(shape.getId().getName()),
                () -> doWithMembers(shape)
            );
        });
    }

    /**
     * Handles the member entries for unions/structures.
     */
    private void doWithMembers(Shape shape) {
        writeTraits(shape);

        writer.write(", [ ");
        shape.getAllMembers().forEach((memberName, member) -> {
            writer.write("$L,", stringStore.var(memberName));
        });
        writer.write(" ], [");
        shape.getAllMembers().forEach((memberName, member) -> {
            String ref = resolveSchema(member);
            if (elision.traits.hasSchemaTraits(member)) {
                writer.openBlock("""
                    [$L,\s""",
                    "],",
                    ref,
                    () -> {
                        writeTraits(member);
                    }
                );
            } else {
                writer.write("$L,", ref);
            }
        });
        writer.write("]");
    }

    private void writeListSchema(CollectionShape shape) {
        checkedWriteSchema(shape, () -> {
            writer.addImportSubmodule("list", "list", TypeScriptDependency.SMITHY_CORE, "/schema");
            writer.openBlock("""
                    export var $L = list($L, $L,""",
                ");",
                getShapeVariableName(shape),
                stringStore.var(shape.getId().getNamespace(), "n"),
                stringStore.var(shape.getId().getName()),
                () -> this.doWithMember(
                    shape,
                    shape.getMember()
                )
            );
        });
    }

    private void writeMapSchema(MapShape shape) {
        checkedWriteSchema(shape, () -> {
            writer.addImportSubmodule("map", "map", TypeScriptDependency.SMITHY_CORE, "/schema");
            writer.openBlock("""
                    export var $L = map($L, $L,""",
                ");",
                getShapeVariableName(shape),
                stringStore.var(shape.getId().getNamespace(), "n"),
                stringStore.var(shape.getId().getName()),
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
        String ref = resolveSchema(memberShape);
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
        String keyRef = resolveSchema(keyShape);
        String valueRef = resolveSchema(memberShape);
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
        writer.addImportSubmodule("op", "op", TypeScriptDependency.SMITHY_CORE, "/schema");
        writer.openBlock("""
            export var $L = op($L, $L,""",
            ");",
            getShapeVariableName(shape),
            stringStore.var(shape.getId().getNamespace(), "n"),
            stringStore.var(shape.getId().getName()),
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
        writer.write(
            new SchemaTraitWriter(shape, elision, stringStore).toString()
        );
    }

    /**
     * Checks whether ok to write minimized schema.
     */
    private void checkedWriteSchema(Shape shape, Runnable schemaWriteFn) {
        if (shape.getId().getNamespace().equals("smithy.api")
            && shape.getId().getName().equals("Unit")) {
            // special signal value for operation input/output.
            writer.write("""
                export var Unit = "unit" as const;
                """);
        } else if (!elision.isReferenceSchema(shape) && !elision.traits.hasSchemaTraits(shape)) {
            String sentinel = this.resolveSchema(shape);

            writer.write(
                """
                export var $L = $L;
                """,
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
    private String resolveSchema(Shape shape) {
        MemberShape memberShape = null;
        if (shape instanceof MemberShape ms) {
            memberShape = ms;
            shape = model.expectShape(memberShape.getTarget());
        }

        boolean isReference = elision.isReferenceSchema(shape);
        boolean hasTraits = elision.traits.hasSchemaTraits(shape);

        if (!hasTraits) {
            try {
                return resolveSimpleSchema(memberShape != null ? memberShape : shape);
            } catch (IllegalArgumentException ignored) {
                //
            }
        }

        return (isReference || hasTraits ? "() => " : "") + getShapeVariableName(shape);
    }

    private String resolveSimpleSchema(Shape shape) {
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
                return resolveSimpleSchemaNestedContainer(shape, writer, stringStore);
            }
            default -> {
                //
            }
        }
        throw new IllegalArgumentException("shape is not simple");
    }

    private String resolveSimpleSchemaNestedContainer(Shape shape, TypeScriptWriter writer, StringStore stringStore) {
        Shape contained;
        String factory;
        String sentinel;
        String keyMemberSchema;
        switch (shape.getType()) {
            case LIST -> {
                contained = shape.asListShape().get().getMember();
                factory = "list";
                keyMemberSchema = "";
                sentinel = "64";
            }
            case MAP -> {
                contained = shape.asMapShape().get().getValue();
                factory = "map";
                keyMemberSchema = this.resolveSimpleSchema(shape.asMapShape().get().getKey()) + ", ";
                sentinel = "128";
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

        if (contained.isListShape()) {
            writer.addImportSubmodule(factory, factory, TypeScriptDependency.SMITHY_CORE, "/schema");
            String schemaVarName = stringStore.var(shape.getId().getName());
            return factory + "(" + stringStore.var(shape.getId().getNamespace(), "n") + ", " + schemaVarName + ", 0, "
                + keyMemberSchema
                + this.resolveSimpleSchema(contained) + ")";
        } else if (contained.isMapShape()) {
            writer.addImportSubmodule(factory, factory, TypeScriptDependency.SMITHY_CORE, "/schema");
            String schemaVarName = stringStore.var(shape.getId().getName());
            return factory + "(" + stringStore.var(shape.getId().getNamespace(), "n") + ", " + schemaVarName + ", 0, "
                + keyMemberSchema
                + this.resolveSimpleSchema(contained) + ")";
        } else {
            return sentinel + "|" + this.resolveSimpleSchema(contained);
        }
    }
}
