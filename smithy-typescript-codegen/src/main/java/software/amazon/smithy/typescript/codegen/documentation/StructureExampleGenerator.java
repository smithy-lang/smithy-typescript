/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.documentation;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.EnumShape;
import software.amazon.smithy.model.shapes.IntEnumShape;
import software.amazon.smithy.model.shapes.ListShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.RequiredTrait;
import software.amazon.smithy.model.traits.StreamingTrait;

/**
 * Generates a structural hint for a shape used in command documentation.
 */
public abstract class StructureExampleGenerator {
    /**
     * Generates an example structure for API documentation, as an
     * automated gap filler for operations that do not have
     * hand written examples.
     *
     * Example for Athena::createPreparedStatement
     * ```js
     * const input = {
     * // QueryStatement: 'STRING_VALUE', // required
     * // StatementName: 'STRING_VALUE', // required
     * // WorkGroup: 'STRING_VALUE', // required
     * // Description: 'STRING_VALUE'
     * };
     * ```
     */
    public static String generateStructuralHintDocumentation(Shape shape, Model model) {
        StringBuilder buffer = new StringBuilder();
        shape(shape, buffer, model, 0, new ShapeTracker());

        // replace non-leading whitespace with single space.
        String s = Arrays.stream(
                buffer.toString()
                        .split("\n"))
                .map(line -> line.replaceAll(
                        "([\\w\\\",:\\[\\{] )\\s+",
                        "$1")
                        .replaceAll("\\s+$", ""))
                .collect(Collectors.joining("\n"));

        return s.replaceAll(",$", ";");
    }

    private static void structure(StructureShape structureShape,
            StringBuilder buffer, Model model,
            int indentation,
            ShapeTracker shapeTracker) {
        if (structureShape.getAllMembers().size() == 0) {
            append(indentation, buffer, "{},");
            checkRequired(indentation, buffer, structureShape);
        } else {
            append(indentation, buffer, "{");
            checkRequired(indentation, buffer, structureShape);
            structureShape.getAllMembers().values().forEach(member -> {
                append(indentation + 2, buffer, member.getMemberName() + ": ");
                shape(member, buffer, model, indentation + 2, shapeTracker);
            });
            append(indentation, buffer, "},\n");
        }
    }

    private static void union(UnionShape unionShape,
            StringBuilder buffer,
            Model model,
            int indentation,
            ShapeTracker shapeTracker) {
        append(indentation, buffer, "{ // Union: only one key present");
        checkRequired(indentation, buffer, unionShape);
        unionShape.getAllMembers().values().forEach(member -> {
            append(indentation + 2, buffer, member.getMemberName() + ": ");
            shape(member, buffer, model, indentation + 2, shapeTracker);
        });
        append(indentation, buffer, "},\n");
    }

    private static void shape(Shape shape,
            StringBuilder buffer,
            Model model,
            int indentation,
            ShapeTracker shapeTracker) {
        Shape target;
        if (shape instanceof MemberShape) {
            target = model.getShape(((MemberShape) shape).getTarget()).get();
        } else {
            target = shape;
        }

        shapeTracker.mark(shape, indentation);
        if (shapeTracker.getOccurrenceDepths(shape) > 2) {
            append(indentation, buffer, "\"<" + shape.getId().getName() + ">\",\n");
        } else {
            switch (target.getType()) {
                case BIG_DECIMAL:
                    append(indentation, buffer, "Number(\"bigdecimal\"),");
                    break;
                case BIG_INTEGER:
                    append(indentation, buffer, "Number(\"bigint\"),");
                    break;
                case BLOB:
                    if (target.hasTrait(StreamingTrait.class)) {
                        append(indentation, buffer, "\"STREAMING_BLOB_VALUE\",");
                    } else {
                        append(indentation, buffer, "\"BLOB_VALUE\",");
                    }
                    break;
                case BOOLEAN:
                    append(indentation, buffer, "true || false,");
                    break;
                case BYTE:
                    append(indentation, buffer, "\"BYTE_VALUE\",");
                    break;
                case DOCUMENT:
                    append(indentation, buffer, "\"DOCUMENT_VALUE\",");
                    break;
                case DOUBLE:
                    append(indentation, buffer, "Number(\"double\"),");
                    break;
                case FLOAT:
                    append(indentation, buffer, "Number(\"float\"),");
                    break;
                case INTEGER:
                    append(indentation, buffer, "Number(\"int\"),");
                    break;
                case LONG:
                    append(indentation, buffer, "Number(\"long\"),");
                    break;
                case SHORT:
                    append(indentation, buffer, "Number(\"short\"),");
                    break;
                case STRING:
                    append(indentation, buffer, "\"STRING_VALUE\",");
                    break;
                case TIMESTAMP:
                    append(indentation, buffer, "new Date(\"TIMESTAMP\"),");
                    break;

                case SET:
                case LIST:
                    append(indentation, buffer, "[");
                    checkRequired(indentation, buffer, shape);
                    ListShape list = (ListShape) target;
                    shape(list.getMember(), buffer, model, indentation + 2, shapeTracker);
                    append(indentation, buffer, "],\n");
                    break;
                case MAP:
                    append(indentation, buffer, "{");
                    checkRequired(indentation, buffer, shape);
                    append(indentation + 2, buffer, "\"<keys>\": ");
                    MapShape map = (MapShape) target;
                    shape(model.getShape(map.getValue().getTarget()).get(), buffer, model, indentation + 2,
                            shapeTracker);
                    append(indentation, buffer, "},\n");
                    break;

                case STRUCTURE:
                    StructureShape structure = (StructureShape) target;
                    structure(structure, buffer, model, indentation, shapeTracker);
                    break;
                case UNION:
                    UnionShape union = (UnionShape) target;
                    union(union, buffer, model, indentation, shapeTracker);
                    break;

                case ENUM:
                    EnumShape enumShape = (EnumShape) target;
                    String enumeration = enumShape.getEnumValues()
                            .values()
                            .stream()
                            .map(s -> "\"" + s + "\"")
                            .collect(Collectors.joining(" || "));
                    append(indentation, buffer, enumeration + ",");
                    break;
                case INT_ENUM:
                    IntEnumShape intEnumShape = (IntEnumShape) target;
                    String intEnumeration = intEnumShape.getEnumValues()
                            .values()
                            .stream()
                            .map(i -> Integer.toString(i))
                            .collect(Collectors.joining(" || "));
                    append(indentation, buffer, intEnumeration + ",");
                    break;
                case OPERATION:
                case RESOURCE:
                case SERVICE:
                case MEMBER:
                default:
                    append(indentation, buffer, "\"...\",");
                    break;
            }

            switch (target.getType()) {
                case STRUCTURE:
                case UNION:
                case LIST:
                case SET:
                case MAP:
                    break;
                case BIG_DECIMAL:
                case BIG_INTEGER:
                case BLOB:
                case BOOLEAN:
                case BYTE:
                case DOCUMENT:
                case DOUBLE:
                case ENUM:
                case FLOAT:
                case INTEGER:
                case INT_ENUM:
                case LONG:
                case MEMBER:
                case OPERATION:
                case RESOURCE:
                case SERVICE:
                case SHORT:
                case STRING:
                case TIMESTAMP:
                default:
                    checkRequired(indentation, buffer, shape);
                    break;
            }
        }
    }

    private static void checkRequired(int indentation, StringBuilder buffer, Shape shape) {
        if (shape.hasTrait(RequiredTrait.class)) {
            append(indentation, buffer, " // required\n");
        } else {
            append(indentation, buffer, "\n");
        }
    }

    private static void append(int indentation, StringBuilder buffer, String tail) {
        while (indentation-- > 0) {
            buffer.append(" ");
        }
        buffer.append(tail);
    }

    /**
     * Tracks the depths at which a shape appears in the tree.
     * If a shape appears at too many depths it is truncated.
     * This handles the case of recursive shapes.
     */
    private static class ShapeTracker {
        private Map<Shape, Set<Integer>> data = new HashMap<Shape, Set<Integer>>();

        /**
         * Mark that a shape is observed at depth.
         */
        public void mark(Shape shape, int depth) {
            if (!data.containsKey(shape)) {
                data.put(shape, new HashSet<>());
            }
            data.get(shape).add(depth);
        }

        /**
         * @return the number of distinct depths in which the shape appears.
         */
        public int getOccurrenceDepths(Shape shape) {
            return data.getOrDefault(shape, Collections.emptySet()).size();
        }
    }
}
