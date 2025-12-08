/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.knowledge;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.TreeSet;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.KnowledgeIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.ListShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.EnumTrait;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.model.traits.PaginatedTrait;
import software.amazon.smithy.typescript.codegen.schema.SchemaReferenceIndex;
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.waiters.WaitableTrait;

/**
 * Retrieves shapes in the service operation closure.
 */
@SmithyInternalApi
public final class ServiceClosure implements KnowledgeIndex {
    private static final ShapeId UNIT = ShapeId.from("smithy.api#Unit");
    private final Model model;
    private final ServiceShape service;

    private final SchemaReferenceIndex elision;

    /**
     * For API testing & schemas.
     */
    private final TreeSet<OperationShape> operations = new TreeSet<>();
    /**
     * Note: also contains unions.
     * For API testing.
     */
    private final TreeSet<Shape> structuralInterfaces = new TreeSet<>();
    /**
     * For API testing.
     */
    private final TreeSet<Shape> errors = new TreeSet<>();
    /**
     * For API testing.
     */
    private final TreeSet<Shape> enums = new TreeSet<>();

    /**
     * For schemas.
     */
    private final TreeSet<StructureShape> structureShapes = new TreeSet<>();
    /**
     * For schemas.
     */
    private final TreeSet<CollectionShape> collectionShapes = new TreeSet<>();
    /**
     * For schemas.
     */
    private final TreeSet<MapShape> mapShapes = new TreeSet<>();
    /**
     * For schemas.
     */
    private final TreeSet<UnionShape> unionShapes = new TreeSet<>();
    /**
     * For schemas.
     */
    private final TreeSet<Shape> simpleShapes = new TreeSet<>();
    /**
     * Used to deconflict schema variable names.
     * Iteration determinism is desired (ordered set).
     */
    private final TreeSet<Shape> existsAsSchema = new TreeSet<>();
    /**
     * For schemas.
     */
    private final Set<Shape> requiresNamingDeconfliction = new HashSet<>();

    /**
     * Used temporarily during initial traversal.
     */
    private final Set<ShapeId> scanned = new HashSet<>();

    private ServiceClosure(
        Model model,
        ServiceShape service
    ) {
        this.model = model;
        this.service = service;
        elision = SchemaReferenceIndex.of(model);
        TopDownIndex topDown = TopDownIndex.of(model);
        Set<OperationShape> containedOperations = topDown.getContainedOperations(service);
        operations.addAll(containedOperations);
        scan(containedOperations);
        scanned.clear();
        deconflictSchemaVarNames();
    }

    public static ServiceClosure of(Model model, ServiceShape service) {
        return model.getKnowledge(ServiceClosure.class, (Model m) -> new ServiceClosure(m, service));
    }

    public TreeSet<Shape> getStructuralNonErrorShapes() {
        return structuralInterfaces;
    }

    public TreeSet<Shape> getErrorShapes() {
        return errors;
    }

    public TreeSet<Shape> getEnums() {
        return enums;
    }

    public TreeSet<String> getWaiterNames() {
        TreeSet<String> waiters = new TreeSet<>();
        for (OperationShape operation : operations) {
            operation.getTrait(WaitableTrait.class).ifPresent(trait -> {
                trait.getWaiters().forEach((waiterName, waiter) -> {
                    waiters.add("waitFor" + waiterName);
                    waiters.add("waitUntil" + waiterName);
                });
            });
        }
        return waiters;
    }

    public TreeSet<String> getPaginatorNames() {
        TreeSet<String> paginators = new TreeSet<>();
        for (OperationShape operation : operations) {
            operation.getTrait(PaginatedTrait.class).ifPresent(trait -> {
                paginators.add("paginate" + operation.getId().getName());
            });
        }
        return paginators;
    }

    public Set<Shape> getRequiresNamingDeconfliction() {
        return requiresNamingDeconfliction;
    }

    public TreeSet<Shape> getSimpleShapes() {
        return simpleShapes;
    }

    public TreeSet<StructureShape> getStructureShapes() {
        return structureShapes;
    }

    public TreeSet<UnionShape> getUnionShapes() {
        return unionShapes;
    }

    public TreeSet<MapShape> getMapShapes() {
        return mapShapes;
    }

    public TreeSet<CollectionShape> getCollectionShapes() {
        return collectionShapes;
    }

    public TreeSet<OperationShape> getOperationShapes() {
        return operations;
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

    private void scan(Shape shape) {
        scan(Collections.singletonList(shape));
    }

    private void scan(Set<OperationShape> shapes) {
        scan(new ArrayList<>(shapes));
    }

    private void scan(Collection<Shape> shapes) {
        for (Shape shape : shapes) {
            if (scanned.contains(shape.getId())) {
                continue;
            }
            scanned.add(shape.getId());

            if (shape.isMemberShape()) {
                MemberShape memberShape = (MemberShape) shape;
                shape = model.expectShape(memberShape.getTarget());
            }

            switch (shape.getType()) {
                case LIST -> {
                    ListShape listShape = (ListShape) shape;
                    collectionShapes.add(listShape);
                    existsAsSchema.add(listShape);
                    scan(listShape.getMember());
                }
                case SET -> {
                    var setShape = shape.asSetShape().get();
                    collectionShapes.add(setShape);
                    existsAsSchema.add(setShape);
                    scan(setShape.getMember());
                }
                case MAP -> {
                    MapShape mapShape = (MapShape) shape;
                    mapShapes.add(mapShape);
                    existsAsSchema.add(mapShape);
                    scan(mapShape.getKey());
                    scan(mapShape.getValue());
                }
                case STRUCTURE, UNION -> {
                    if (shape.isStructureShape()) {
                        structureShapes.add(shape.asStructureShape().get());
                    } else if (shape.isUnionShape()) {
                        unionShapes.add(shape.asUnionShape().get());
                    }
                    existsAsSchema.add(shape);

                    if (shape.hasTrait(ErrorTrait.class)) {
                        errors.add(shape);
                    } else if (!shape.getId().equals(UNIT)) {
                        structuralInterfaces.add(shape);
                    }

                    if (shape instanceof StructureShape structureShape) {
                        structureShape.getAllMembers().values().forEach(this::scan);
                    } else if (shape instanceof UnionShape unionShape) {
                        unionShape.getAllMembers().values().forEach(this::scan);
                    }
                }
                case OPERATION -> {
                    OperationShape operation = (OperationShape) shape;
                    if (operation.getInput().isPresent()) {
                        scan(model.expectShape(operation.getInputShape()));
                    } else {
                        scan(model.expectShape(UNIT));
                    }
                    if (operation.getOutput().isPresent()) {
                        scan(model.expectShape(operation.getOutputShape()));
                    } else {
                        scan(model.expectShape(UNIT));
                    }
                    operation.getErrors(service).forEach(error -> {
                        scan(model.expectShape(error));
                    });
                    operations.add(operation);
                    existsAsSchema.add(operation);
                }
                case BYTE, INT_ENUM, SHORT, INTEGER, LONG, FLOAT, DOUBLE, BIG_INTEGER, BIG_DECIMAL, BOOLEAN, STRING,
                     TIMESTAMP, DOCUMENT, ENUM, BLOB -> {
                    if (shape.isEnumShape() || shape.isIntEnumShape() || shape.hasTrait(EnumTrait.class)) {
                        enums.add(shape);
                    }

                    if (elision.traits.hasSchemaTraits(shape)) {
                        existsAsSchema.add(shape);
                    }
                    simpleShapes.add(shape);
                }
                default -> {
                    // ...
                }
            }
        }
    }
}
