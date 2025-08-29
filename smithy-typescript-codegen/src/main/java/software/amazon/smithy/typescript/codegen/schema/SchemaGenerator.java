/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.schema;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
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
    private final Map<String, TypeScriptWriter> writers = new HashMap<>();

    private final Set<String> loadShapesVisited = new HashSet<>();

    private final Set<StructureShape> structureShapes = new TreeSet<>();
    private final Set<CollectionShape> collectionShapes = new TreeSet<>();
    private final Set<MapShape> mapShapes = new TreeSet<>();
    private final Set<UnionShape> unionShapes = new TreeSet<>();
    private final Set<OperationShape> operationShapes = new TreeSet<>();
    private final Set<Shape> simpleShapes = new TreeSet<>();

    private final Set<Shape> existsAsSchema = new HashSet<>();
    private final Set<Shape> requiresNamingDeconfliction = new HashSet<>();
    private ShapeTreeOrganizer treeOrganizer;

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
    }

    /**
     * Writes all schemas for the model to a schemas.ts file.
     */
    @Override
    public void run() {
        treeOrganizer = ShapeTreeOrganizer.forModel(model);
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

        String stringConstants = store.flushVariableDeclarationCode()
            .replaceAll("const ", "export const ");

        for (Map.Entry<String, TypeScriptWriter> entry : writers.entrySet()) {
            String group = entry.getKey();
            TypeScriptWriter writer = entry.getValue();

            boolean hasContent = !writer.toString().endsWith("/* eslint no-var: 0 */\n");
            if (hasContent) {
                if (group.equals("schemas_0")) {
                    fileManifest.writeFile(
                        Paths.get(CodegenUtils.SOURCE_FOLDER, SCHEMAS_FOLDER,  group + ".ts").toString(),
                        stringConstants + "\n" + writer
                    );
                } else {
                    fileManifest.writeFile(
                        Paths.get(CodegenUtils.SOURCE_FOLDER, SCHEMAS_FOLDER,  group + ".ts").toString(),
                        writer.toString()
                    );
                }
            }
        }

        treeOrganizer.debug();
    }

    private TypeScriptWriter getWriter(ShapeId shape) {
        return writers.computeIfAbsent(treeOrganizer.getGroup(shape), k -> {
            TypeScriptWriter typeScriptWriter = new TypeScriptWriter("");
            typeScriptWriter.write("""
                /* eslint no-var: 0 */
            """);
            return typeScriptWriter;
        });
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
            symbolName += "_" + checkImportString(shape, shape.getId().getNamespace(), "n");
        }
        return symbolName;
    }

    private void writeSimpleSchema(Shape shape) {
        TypeScriptWriter writer = getWriter(shape.getId());
        if (elision.traits.hasSchemaTraits(shape)) {
            writer.addImportSubmodule("sim", "sim", TypeScriptDependency.SMITHY_CORE, "/schema");
            writer.write("""
                    export var $L = sim($L, $L, $L,""",
                getShapeVariableName(shape),
                checkImportString(shape, shape.getId().getNamespace(), "n"),
                checkImportString(shape, shape.getId().getName()),
                resolveSimpleSchema(shape)
            );
            writeTraits(shape);
            writer.write(");");
        }
    }

    private void writeStructureSchema(StructureShape shape) {
        TypeScriptWriter writer = getWriter(shape.getId());
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
                    checkImportString(shape, shape.getId().getNamespace(), "n"),
                    checkImportString(shape, shape.getId().getName()),
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
                    checkImportString(shape, shape.getId().getNamespace(), "n"),
                    checkImportString(shape, shape.getId().getName()),
                    () -> doWithMembers(shape)
                );
            }
        });
    }

    private void writeBaseError() {
        TypeScriptWriter writer = writers.get("schemas_0");

        String serviceName = CodegenUtils.getServiceName(settings, model, symbolProvider);
        String serviceExceptionName = CodegenUtils.getServiceExceptionName(serviceName);
        String namespace = settings.getService(model).getId().getNamespace();

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
        TypeScriptWriter writer = getWriter(shape.getId());
        checkedWriteSchema(shape, () -> {
            writer.addImportSubmodule("struct", "uni", TypeScriptDependency.SMITHY_CORE, "/schema");
            writer.openBlock("""
                    export var $L = uni($L, $L,""",
                ");",
                getShapeVariableName(shape),
                checkImportString(shape, shape.getId().getNamespace(), "n"),
                checkImportString(shape, shape.getId().getName()),
                () -> doWithMembers(shape)
            );
        });
    }

    /**
     * Handles the member entries for unions/structures.
     */
    private void doWithMembers(Shape shape) {
        TypeScriptWriter writer = getWriter(shape.getId());
        writeTraits(shape);

        // member names.
        writer.write(", [ ");
        shape.getAllMembers().forEach((memberName, member) -> {
            writer.write("$L,", checkImportString(shape, memberName));
        });

        // member schemas.
        writer.write(" ], [");
        shape.getAllMembers().forEach((memberName, member) -> {
            String ref = resolveSchema(shape, member);
            if (elision.traits.hasSchemaTraits(member)) {
                writer.openBlock("""
                    [$L,\s""",
                    "],",
                    ref,
                    () -> {
                        writeTraitsInContext(shape, member);
                    }
                );
            } else {
                writer.write("$L,", ref);
            }
        });
        writer.write("]");
    }

    private void writeListSchema(CollectionShape shape) {
        TypeScriptWriter writer = getWriter(shape.getId());
        checkedWriteSchema(shape, () -> {
            writer.addImportSubmodule("list", "list", TypeScriptDependency.SMITHY_CORE, "/schema");
            writer.openBlock("""
                    export var $L = list($L, $L,""",
                ");",
                getShapeVariableName(shape),
                checkImportString(shape, shape.getId().getNamespace(), "n"),
                checkImportString(shape, shape.getId().getName()),
                () -> this.doWithMember(
                    shape,
                    shape.getMember()
                )
            );
        });
    }

    private void writeMapSchema(MapShape shape) {
        TypeScriptWriter writer = getWriter(shape.getId());
        checkedWriteSchema(shape, () -> {
            writer.addImportSubmodule("map", "map", TypeScriptDependency.SMITHY_CORE, "/schema");
            writer.openBlock("""
                    export var $L = map($L, $L,""",
                ");",
                getShapeVariableName(shape),
                checkImportString(shape, shape.getId().getNamespace(), "n"),
                checkImportString(shape, shape.getId().getName()),
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
        TypeScriptWriter writer = getWriter(shape.getId());
        writeTraits(shape);
        String ref = resolveSchema(shape, memberShape);
        if (elision.traits.hasSchemaTraits(memberShape)) {
            writer.openBlock(
                ", [$L, ",
                "]",
                ref,
                () -> {
                    writeTraitsInContext(shape, memberShape);
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
        TypeScriptWriter writer = getWriter(shape.getId());
        writeTraits(shape);
        String keyRef = resolveSchema(shape, keyShape);
        String valueRef = resolveSchema(shape, memberShape);
        if (elision.traits.hasSchemaTraits(memberShape) || elision.traits.hasSchemaTraits(keyShape)) {
            writer.openBlock(
                ", [$L, ",
                "]",
                keyRef,
                () -> {
                    writeTraitsInContext(shape, keyShape);
                }
            );
            writer.openBlock(
                ", [$L, ",
                "]",
                valueRef,
                () -> {
                    writeTraitsInContext(shape, memberShape);
                }
            );
        } else {
            writer.write(", $L, $L", keyRef, valueRef);
        }
    }

    private void writeOperationSchema(OperationShape shape) {
        TypeScriptWriter writer = getWriter(shape.getId());
        writer.addImportSubmodule("op", "op", TypeScriptDependency.SMITHY_CORE, "/schema");
        writer.openBlock("""
            export var $L = op($L, $L,""",
            ");",
            getShapeVariableName(shape),
            checkImportString(shape, shape.getId().getNamespace(), "n"),
            checkImportString(shape, shape.getId().getName()),
            () -> {
                writeTraits(shape);
                checkImportSchema(shape, model.expectShape(shape.getInputShape()));
                checkImportSchema(shape, model.expectShape(shape.getOutputShape()));
                writer.write("""
                    , () => $L, () => $L""",
                    getShapeVariableName(model.expectShape(shape.getInputShape())),
                    getShapeVariableName(model.expectShape(shape.getOutputShape()))
                );
            }
        );
    }

    private void writeTraits(Shape shape) {
        writeTraitsInContext(shape, shape);
    }

    private void writeTraitsInContext(Shape context, Shape shape) {
        TypeScriptWriter writer = getWriter(context.getId());
        boolean useImportedStrings = !treeOrganizer.isBaseGroup(context);

        writer.write(
            new SchemaTraitWriter(
                shape, elision,
                useImportedStrings ? store.useSchemaWriter(writer) : store
            ).toString()
        );
    }

    /**
     * Checks whether ok to write minimized schema.
     */
    private void checkedWriteSchema(Shape shape, Runnable schemaWriteFn) {
        TypeScriptWriter writer = getWriter(shape.getId());
        if (shape.getId().getNamespace().equals("smithy.api")
            && shape.getId().getName().equals("Unit")) {
            // special signal value for operation input/output.
            writer.write("""
                export var Unit = "unit" as const;
                """);
        } else if (!elision.isReferenceSchema(shape) && !elision.traits.hasSchemaTraits(shape)) {
            String sentinel = this.resolveSchema(model.expectShape(ShapeId.from("smithy.api#Unit")), shape);

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
                return resolveSimpleSchema(memberShape != null ? memberShape : shape);
            } catch (IllegalArgumentException ignored) {
                //
            }
        }

        if (isReference || hasTraits) {
            checkImportSchema(context, shape);
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
                TypeScriptWriter writer = getWriter(shape.getId());
                return resolveSimpleSchemaNestedContainer(shape, writer);
            }
            default -> {
                //
            }
        }
        throw new IllegalArgumentException("shape is not simple");
    }

    private String resolveSimpleSchemaNestedContainer(Shape shape, TypeScriptWriter writer) {
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
            String schemaVarName = checkImportString(shape, shape.getId().getName());
            return factory + "("
                + checkImportString(shape, shape.getId().getNamespace(), "n") + ", " + schemaVarName + ", 0, "
                + keyMemberSchema
                + this.resolveSimpleSchema(contained) + ")";
        } else if (contained.isMapShape()) {
            writer.addImportSubmodule(factory, factory, TypeScriptDependency.SMITHY_CORE, "/schema");
            String schemaVarName = checkImportString(shape, shape.getId().getName());
            return factory + "("
                + checkImportString(shape, shape.getId().getNamespace(), "n") + ", " + schemaVarName + ", 0, "
                + keyMemberSchema
                + this.resolveSimpleSchema(contained) + ")";
        } else {
            return sentinel + "|" + this.resolveSimpleSchema(contained);
        }
    }

    private void checkImportSchema(Shape context, Shape shape) {
        String shapeGroup = treeOrganizer.getGroup(shape.getId());
        if (treeOrganizer.different(context, shape)) {
            getWriter(context.getId()).addRelativeImport(
                getShapeVariableName(shape), null, Path.of("./", shapeGroup)
            );
        }
    }

    private String checkImportString(Shape context, String fullString) {
        return checkImportString(context, fullString, null);
    }

    private String checkImportString(Shape context, String fullString, String prefix) {
        String var = prefix != null ? store.var(fullString, prefix) : store.var(fullString);
        if (!treeOrganizer.isBaseGroup(context)) {
            getWriter(context.getId()).addRelativeImport(
                var,
                null,
                Path.of("./schemas_0")
            );
        }
        return var;
    }
}
