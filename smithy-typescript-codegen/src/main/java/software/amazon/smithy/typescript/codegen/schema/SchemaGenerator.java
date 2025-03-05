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
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.stream.Collectors;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.codegen.core.ReservedWords;
import software.amazon.smithy.codegen.core.ReservedWordsBuilder;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.ListShape;
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
    private final Model model;
    private final SchemaTraitGenerator traitGenerator;
    private final FileManifest fileManifest;
    private final Map<String, StringStore> namespaceStringStores = new HashMap<>();
    private final Map<String, TypeScriptWriter> namespaceWriters = new HashMap<>();

    private final Set<String> loadShapesVisited = new HashSet<>();

    private final Set<StructureShape> structureShapes = new TreeSet<>();
    private final Set<CollectionShape> collectionShapes = new TreeSet<>();
    private final Set<MapShape> mapShapes = new TreeSet<>();
    private final Set<UnionShape> unionShapes = new TreeSet<>();
    private final Set<OperationShape> operationShapes = new TreeSet<>();
    private final Map<Shape, String> simpleShapes = new TreeMap<>();

    private final ReservedWords reservedWords = new ReservedWordsBuilder()
        .loadWords(Objects.requireNonNull(TypeScriptClientCodegenPlugin.class.getResource("reserved-words.txt")))
        .build();

    public SchemaGenerator(Model model,
                           FileManifest fileManifest) {
        this.model = model;
        this.fileManifest = fileManifest;
        traitGenerator = new SchemaTraitGenerator();
        elision = SchemaReferenceIndex.of(model);
    }

    /**
     * Writes all schemas for the model to a schemas.ts file.
     */
    @Override
    public void run() {
        for (ServiceShape service : model.getServiceShapes()) {
            if (!SchemaGenerationAllowlist.contains(service.getId())) {
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
            }
        }

        for (Map.Entry<String, StringStore> entry : namespaceStringStores.entrySet()) {
            String namespace = entry.getKey();
            TypeScriptWriter writer = getWriterForNamespace(namespace);
            writer.addImportSubmodule("TypeRegistry", null, TypeScriptDependency.SMITHY_CORE, "/schema");
            writer.write(
                """
                export const $1L = TypeRegistry.for($2S);
                $1L.startCapture();""",
                getRegistrySymbol(namespace),
                namespace
            );
        }

        structureShapes.forEach(this::writeStructureSchema);
        collectionShapes.forEach(this::writeListSchema);
        mapShapes.forEach(this::writeMapSchema);
        unionShapes.forEach(this::writeUnionSchema);
        operationShapes.forEach(this::writeOperationSchema);

        TypeScriptWriter indexWriter = new TypeScriptWriter("");

        for (Map.Entry<String, TypeScriptWriter> stringTypeScriptWriterEntry : namespaceWriters.entrySet()) {
            String namespace = stringTypeScriptWriterEntry.getKey();
            TypeScriptWriter writer = stringTypeScriptWriterEntry.getValue();

            writer.write(
                """
                $L.stopCapture();""",
                getRegistrySymbol(namespace)
            );

            String stringVariables = getStringStoreForNamespace(namespace).flushVariableDeclarationCode();

            fileManifest.writeFile(
                Paths.get(CodegenUtils.SOURCE_FOLDER, SCHEMAS_FOLDER,  namespace + ".ts").toString(),
                stringVariables + "\n" + writer
            );
            indexWriter.write("""
                export * from "./%s"
                """.formatted(namespace)
            );
        }

        fileManifest.writeFile(
            Paths.get(CodegenUtils.SOURCE_FOLDER, SCHEMAS_FOLDER,  "index.ts").toString(),
            indexWriter.toString()
        );
    }

    private String getRegistrySymbol(String namespace) {
        return namespace.replaceAll("\\.", "_") + "Registry";
    }

    /**
     * Identifies repeated strings among the schemas to use in StringStore.
     */
    private void loadShapes(Shape shape) {
        StringStore stringStore = getStringStoreForNamespace(shape);
        String absoluteName = shape.getId().toString();
        String name = shape.getId().getName();

        if (shape.isMemberShape()) {
            loadShapes(model.expectShape(shape.asMemberShape().get().getTarget()));
            return;
        }

        if (loadShapesVisited.contains(absoluteName)) {
            return;
        }

        if (!elision.isReferenceSchema(shape)) {
            stringStore.var(name);
        }
        loadShapesVisited.add(absoluteName);

        switch (shape.getType()) {
            case LIST -> collectionShapes.add(shape.asListShape().get());
            case SET -> collectionShapes.add((ListShape) shape);
            case MAP -> mapShapes.add(shape.asMapShape().get());
            case STRUCTURE -> structureShapes.add(shape.asStructureShape().get());
            case UNION -> unionShapes.add(shape.asUnionShape().get());
            case BYTE, INT_ENUM, SHORT, INTEGER, LONG, FLOAT, DOUBLE -> simpleShapes.put(shape, "number");
            case BIG_INTEGER -> simpleShapes.put(shape, "bigint");
            case BIG_DECIMAL -> simpleShapes.put(shape, "bigdecimal");
            case BOOLEAN -> simpleShapes.put(shape, "boolean");
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
     * Writers are per file where the filename is the namespace of the schema.
     */
    private TypeScriptWriter getWriterForNamespace(Shape shape) {
        return getWriterForNamespace(shape.getId().getNamespace());
    }

    private TypeScriptWriter getWriterForNamespace(String namespace) {
        boolean isNew = !namespaceWriters.containsKey(namespace);
        namespaceWriters.putIfAbsent(namespace, new TypeScriptWriter(""));
        TypeScriptWriter writer = namespaceWriters.get(namespace);
        if (isNew) {
            writer.write(
                """
                /* eslint no-var: 0 */
                """
            );
        }
        return writer;
    }

    /**
     * There is a string store for each writer.
     */
    private StringStore getStringStoreForNamespace(Shape shape) {
        return getStringStoreForNamespace(shape.getId().getNamespace());
    }

    private StringStore getStringStoreForNamespace(String namespace) {
        namespaceStringStores.putIfAbsent(namespace, new StringStore());
        return namespaceStringStores.get(namespace);
    }

    private void writeStructureSchema(StructureShape shape) {
        TypeScriptWriter writer = getWriterForNamespace(shape);
        StringStore stringStore = getStringStoreForNamespace(shape);
        checkedWriteSchema(shape, () -> {
            String symbolName = reservedWords.escape(shape.getId().getName());
            if (shape.hasTrait(ErrorTrait.class)) {
                String exceptionCtorSymbolName = "__" + symbolName;
                writer.addImportSubmodule("error", "__error", TypeScriptDependency.SMITHY_CORE, "/schema");
                writer.addRelativeImport(
                    symbolName,
                    exceptionCtorSymbolName,
                    Paths.get("..", "models", "index")
                );
                writer.openBlock("""
                export var $L = __error($L,""",
                    "",
                    symbolName,
                    stringStore.var(shape.getId().getName()),
                    () -> doWithMembers(shape, writer, stringStore)
                );
                writer.writeInline(",$L", exceptionCtorSymbolName);
                writer.write(");");
            } else {
                writer.addImportSubmodule("struct", "__struct", TypeScriptDependency.SMITHY_CORE, "/schema");
                writer.openBlock("""
                export var $L = __struct($L,""",
                    ");",
                    symbolName,
                    stringStore.var(shape.getId().getName()),
                    () -> doWithMembers(shape, writer, stringStore)
                );
            }
        });
    }

    private void writeUnionSchema(UnionShape shape) {
        TypeScriptWriter writer = getWriterForNamespace(shape);
        StringStore stringStore = getStringStoreForNamespace(shape);
        checkedWriteSchema(shape, () -> {
            writer.addImportSubmodule("struct", "__uni", TypeScriptDependency.SMITHY_CORE, "/schema");
            writer.openBlock("""
                    export var $L = __uni($L,""",
                ");",
                reservedWords.escape(shape.getId().getName()),
                stringStore.var(shape.getId().getName()),
                () -> doWithMembers(shape, writer, stringStore)
            );
        });
    }

    /**
     * Handles the member entries for unions/structures.
     */
    private void doWithMembers(Shape shape, TypeScriptWriter writer, StringStore stringStore) {
        writeTraits(shape, writer, stringStore);

        writer.write(", [ ");
        shape.getAllMembers().forEach((memberName, member) -> {
            writer.write("$L,", stringStore.var(memberName));
        });
        writer.write(" ], [");
        shape.getAllMembers().forEach((memberName, member) -> {
            checkCrossNamespaceImport(shape, member, writer);
            String ref = resolveSchema(member);
            if (elision.traits.hasSchemaTraits(member)) {
                writer.openBlock("""
                    [$L,\s""",
                    "],",
                    ref,
                    () -> {
                        writeTraits(member, writer, stringStore);
                    }
                );
            } else {
                writer.write("$L,", ref);
            }
        });
        writer.write("]");
    }

    private void writeListSchema(CollectionShape shape) {
        TypeScriptWriter writer = getWriterForNamespace(shape);
        StringStore stringStore = getStringStoreForNamespace(shape);

        checkedWriteSchema(shape, () -> {
            writer.addImportSubmodule("list", "__list", TypeScriptDependency.SMITHY_CORE, "/schema");
            writer.openBlock("""
                    export var $L = __list($L,""",
                ");",
                reservedWords.escape(shape.getId().getName()),
                stringStore.var(shape.getId().getName()),
                () -> this.doWithMember(
                    shape,
                    shape.getMember(),
                    writer,
                    stringStore
                )
            );
        });
    }

    private void writeMapSchema(MapShape shape) {
        TypeScriptWriter writer = getWriterForNamespace(shape);
        StringStore stringStore = getStringStoreForNamespace(shape);

        checkedWriteSchema(shape, () -> {
            writer.addImportSubmodule("map", "__map", TypeScriptDependency.SMITHY_CORE, "/schema");
            writer.openBlock("""
                    export var $L = __map($L,""",
                ");",
                reservedWords.escape(shape.getId().getName()),
                stringStore.var(shape.getId().getName()),
                () -> this.doWithMember(
                    shape,
                    shape.getValue(),
                    writer,
                    stringStore
                )
            );
        });
    }

    /**
     * Write member schema insertion for lists, maps.
     */
    private void doWithMember(Shape shape, MemberShape memberShape, TypeScriptWriter writer, StringStore stringStore) {
        writeTraits(shape, writer, stringStore);
        checkCrossNamespaceImport(shape, memberShape, writer);
        String ref = resolveSchema(memberShape);
        if (elision.traits.hasSchemaTraits(memberShape)) {
            writer.openBlock(
                ", [$L, ",
                "]",
                ref,
                () -> {
                    writeTraits(memberShape, writer, stringStore);
                }
            );
        } else {
            writer.write(", $L", ref);
        }
    }

    private void writeOperationSchema(OperationShape shape) {
        TypeScriptWriter writer = getWriterForNamespace(shape);
        StringStore stringStore = getStringStoreForNamespace(shape);
        writer.addImportSubmodule("op", "__op", TypeScriptDependency.SMITHY_CORE, "/schema");
        writer.openBlock("""
            export var $L = __op($L,""",
            ");",
            reservedWords.escape(shape.getId().getName()),
            stringStore.var(shape.getId().getName()),
            () -> {
                writeTraits(shape, writer, stringStore);
                checkCrossNamespaceImport(shape, model.expectShape(shape.getInputShape()), writer);
                checkCrossNamespaceImport(shape, model.expectShape(shape.getOutputShape()), writer);
                writer.write("""
                    , () => $L, () => $L""",
                    reservedWords.escape(shape.getInputShape().getName()),
                    reservedWords.escape(shape.getOutputShape().getName())
                );
            }
        );
    }

    private void writeTraits(Shape shape, TypeScriptWriter writer, StringStore stringStore) {
        writer.openBlock("{", "}", () -> {
            shape.getAllTraits().forEach((shapeId, trait) -> {
                if (!elision.traits.includeTrait(trait.getClass())) {
                    return;
                }
                writer.write("""
                            [$L]: $L,""",
                    stringStore.var(shapeId.getName()),
                    traitGenerator.serializeTraitData(trait, stringStore)
                );
            });
        });
    }

    /**
     * Checks whether ok to write minimized schema.
     */
    private void checkedWriteSchema(Shape shape, Runnable schemaWriteFn) {
        TypeScriptWriter writer = getWriterForNamespace(shape);
        if (shape.getId().getNamespace().equals("smithy.api")
            && shape.getId().getName().equals("Unit")) {
            // special signal value for operation input/output.
            writer.write("""
                export var Unit = "unit";
                """);
        } else if (!elision.isReferenceSchema(shape) && !elision.traits.hasSchemaTraits(shape)) {
            String sentinel = this.resolveSchema(shape);

            writer.write(
                """
                export var $L = $L;
                """,
                reservedWords.escape(shape.getId().getName()),
                sentinel
            );
        } else {
            schemaWriteFn.run();
        }
    }

    /**
     * Imports a schema from another namespace if needed.
     */
    private void checkCrossNamespaceImport(Shape context, Shape shape, TypeScriptWriter writer) {
        Shape target = shape;
        if (shape instanceof MemberShape member) {
            target = model.expectShape(member.getTarget());
        }
        if (!Objects.equals(
            context.getId().getNamespace(),
            target.getId().getNamespace()
        )) {
            if (elision.isReferenceSchema(shape)) {
                writer.addRelativeImport(
                    reservedWords.escape(target.getId().getName()),
                    null,
                    getImportSource(target.getId().getNamespace())
                );
            }
        }
    }

    private Path getImportSource(String namespace) {
        return Paths.get("./", namespace);
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

        ShapeType type = shape.getType();
        boolean isReference = elision.isReferenceSchema(shape);
        boolean hasTraits = elision.traits.hasSchemaTraits(shape);

        if (!hasTraits) {
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
                case LIST, SET -> {
                    if (!isReference) {
                        if (shape.isSetShape()) {
                            return "64|" + this.resolveSchema(shape.asSetShape().get().getMember());
                        }
                        return "64|" + this.resolveSchema(shape.asListShape().get().getMember());
                    }
                }
                case MAP -> {
                    if (!isReference) {
                        return "128|" + this.resolveSchema(shape.asMapShape().get().getValue());
                    }
                }
                default -> {
                    //
                }
            }
        }

        return (isReference || hasTraits ? "() => " : "") + reservedWords.escape(shape.getId().getName());
    }
}
