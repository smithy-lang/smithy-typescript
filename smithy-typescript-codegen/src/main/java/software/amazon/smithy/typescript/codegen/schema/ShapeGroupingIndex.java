/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.schema;

import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.KnowledgeIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Creates schema groupings.
 * E.g. used to create disjoint sets of schemas to assist with tree-shaking.
 */
@SmithyInternalApi
public class ShapeGroupingIndex implements KnowledgeIndex {
    public static final String FILENAME_PREFIX = "schemas";

    /**
     * The maximum number of operations to place into one group (file).
     */
    public static final int MAX_OPERATIONS_GROUP_SIZE = 12;

    /**
     * Instances of this class for specific models.
     */
    private static final Map<Model, ShapeGroupingIndex> INSTANCES = new ConcurrentHashMap<>();

    /**
     * Shapes mapped to operations that use them.
     */
    private final Map<ShapeId, TreeSet<ShapeId>> shapeToOperationDependents = new HashMap<>();

    /**
     * Shapes mapped to the largest logical grouping of operations making use of the shape.
     */
    private final Map<ShapeId, TreeSet<ShapeId>> shapeToOperationalGroup = new HashMap<>();

    /**
     * Hashed combined operation names to their numeric group id.
     */
    private final Map<String, Integer> opGroups = new HashMap<>();

    /**
     * Combined operation names mapped to a readable group name.
     */
    private final Map<String, String> groupNames = new HashMap<>();

    /**
     * Last group assigned by increasing number.
     */
    private int lastGroup = 0;

    /**
     * Contextual model.
     */
    private Model model;

    public static ShapeGroupingIndex of(Model model) {
        return INSTANCES.computeIfAbsent(model, k -> {
            ShapeGroupingIndex shapeTreeOrganizer = new ShapeGroupingIndex();
            shapeTreeOrganizer.loadModel(model);
            return shapeTreeOrganizer;
        });
    }

    /**
     * @return the group name (filename) of the schema group for the given shape.
     */
    public String getGroup(ShapeId id) {
        if (!shapeToOperationalGroup.containsKey(id)) {
            return getBaseGroup();
        }
        TreeSet<ShapeId> operations = shapeToOperationalGroup.get(id);
        return hashOperationSet(operations);
    }

    /**
     * @return whether shape is in the base group.
     */
    public boolean isBaseGroup(Shape shape) {
        return getGroup(shape.getId()).equals(getBaseGroup());
    }

    /**
     * @return whether two shapes are in different groups.
     */
    public boolean different(Shape a, Shape b) {
        return !Objects.equals(
            getGroup(a.getId()),
            getGroup(b.getId())
        );
    }

    /**
     * Initialize for given model.
     */
    private void loadModel(Model model) {
        if (this.model != null) {
            throw new IllegalArgumentException("Model has already been loaded");
        }
        this.model = model;
        for (ServiceShape service : model.getServiceShapes()) {
            for (OperationShape operation : TopDownIndex.of(model).getContainedOperations(service)) {
                readOperationClosure(operation, new HashSet<>());
            }
        }

        // restack operational groups.
        for (Map.Entry<ShapeId, TreeSet<ShapeId>> entry : shapeToOperationDependents.entrySet()) {
            ShapeId shapeId = entry.getKey();
            TreeSet<ShapeId> dependentOperations = entry.getValue();

            shapeToOperationalGroup.put(shapeId,
                shapeToOperationDependents.values()
                    .stream()
                    .filter(group -> group.size() < MAX_OPERATIONS_GROUP_SIZE)
                    .filter(group -> group.containsAll(dependentOperations))
                    .max(Comparator.comparing(TreeSet::size))
                    .orElse(dependentOperations)
            );
        }

        // precompute group allocations.
        shapeToOperationalGroup.keySet()
            .forEach(this::getGroup);
    }

    /**
     * @return a string hash identifying the group that this set of operations is assigned to.
     */
    private String hashOperationSet(TreeSet<ShapeId> operations) {
        if (operations.size() > MAX_OPERATIONS_GROUP_SIZE) {
            return getBaseGroup();
        }
        String key = joinOperationNames(operations);
        if (opGroups.containsKey(key) && groupNames.containsKey(key)) {
            return FILENAME_PREFIX
                + "_" + opGroups.get(key)
                + "_" + groupNames.get(key);
        } else {
            opGroups.put(key, ++lastGroup);
            groupNames.put(key, nominateGroupName(operations));
        }
        return FILENAME_PREFIX
            + "_" + lastGroup
            + "_" + groupNames.get(key);
    }

    /**
     * Determines a name for the group of operations
     * based on the most commonly observed name or structure.
     * Uses "longest common phrase" algorithm.
     */
    private String nominateGroupName(TreeSet<ShapeId> operations) {
        if (operations.size() == 1) {
            return operations.iterator().next().getName();
        }

        Set<String> names = operations.stream().map(ShapeId::getName).collect(Collectors.toSet());
        int minLength = 3;

        Stream<String> phrases = names.stream()
            .flatMap(operationName -> names.stream()
                .filter(otherOperationName -> !otherOperationName.equals(operationName))
                .flatMap(other -> {
                    Set<String> wordPhrases = new HashSet<>();

                    // expensive, but cached.
                    for (int i = 0; i < operationName.length(); ++i) {
                        for (int j = i + 1; j <= operationName.length(); ++j) {
                            String candidate = operationName.substring(i, j);

                            if (candidate.length() >= minLength && other.contains(candidate)) {
                                boolean validNounPhrase = isValidNounPhrase(operationName, i, j);
                                if (validNounPhrase) {
                                    wordPhrases.add(candidate);
                                }
                            }
                        }
                    }

                    return wordPhrases.stream();
                })
            );

        return phrases
            .collect(Collectors.groupingBy(s -> s, Collectors.counting()))
            .entrySet()
            .stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse("");
    }

    /**
     * The substring from i to j starts with a capital letter and ends
     * with the string or at another capital letter or number.
     */
    private static boolean isValidNounPhrase(String name, int i, int j) {
        String candidate = name.substring(i, j);

        boolean capitalInitialChar = candidate.substring(0, 1).matches("[A-Z]");
        boolean endsWord = name.length() == j
            || name.substring(j, j + 1).matches("[A-Z0-9]");

        return capitalInitialChar && endsWord;
    }

    private String getBaseGroup() {
        return FILENAME_PREFIX + "_0";
    }

    /**
     * Make known that a shape id is used within a certain operation.
     */
    private void register(ShapeId operationId, ShapeId shapeId) {
        shapeToOperationDependents.computeIfAbsent(shapeId, k -> new TreeSet<>()).add(operationId);
    }

    /**
     * Explore the set of shapes in the closure of an operation.
     */
    private void readOperationClosure(OperationShape op, Set<Shape> visited) {
        registerShapes(op, op, visited);
        op.getInput().ifPresent(inputShape -> {
            registerShapes(op, model.expectShape(inputShape), visited);
        });
        op.getOutput().ifPresent(outputShape -> {
            registerShapes(op, model.expectShape(outputShape), visited);
        });
        op.getErrors().forEach(error -> {
            registerShapes(op, model.expectShape(error), visited);
        });
    }

    /**
     * Registers knowledge of the shape in the context of an operation.
     * Recurses on referenced shapes in the input shape.
     */
    private void registerShapes(OperationShape op, Shape shape, Set<Shape> visited) {
        if (shape.isMemberShape()) {
            registerShapes(op, model.expectShape(shape.asMemberShape().get().getTarget()), visited);
            return;
        }
        if (visited.contains(shape)) {
            return;
        }
        visited.add(shape);
        register(op.getId(), shape.getId());

        Set<Shape> memberTargetShapes = shape.getAllMembers().values().stream()
            .map(MemberShape::getTarget)
            .map(model::expectShape)
            .collect(Collectors.toSet());

        for (Shape memberTargetShape : memberTargetShapes) {
            registerShapes(op, memberTargetShape, visited);
        }
    }

    /**
     * Used to create a hash of a set of operations.
     */
    private String joinOperationNames(TreeSet<ShapeId> operations) {
        return operations.stream().map(ShapeId::getName).collect(Collectors.joining(","));
    }
}
