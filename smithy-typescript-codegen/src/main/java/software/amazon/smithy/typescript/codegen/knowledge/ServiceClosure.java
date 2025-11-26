/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.knowledge;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.KnowledgeIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
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
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.waiters.WaitableTrait;

/**
 * Retrieves shapes in the service operation closure.
 */
@SmithyInternalApi
public final class ServiceClosure implements KnowledgeIndex {
    private static final Map<ShapeId, ServiceClosure> BY_SERVICE = new ConcurrentHashMap<>();
    private final Model model;

    private final TreeSet<OperationShape> operations = new TreeSet<>();
    private final TreeSet<Shape> structures = new TreeSet<>();
    private final TreeSet<Shape> errors = new TreeSet<>();
    private final TreeSet<Shape> enums = new TreeSet<>();

    private final Set<Shape> scanned = new HashSet<>();

    private ServiceClosure(
        Model model
    ) {
        this.model = model;
    }

    public static ServiceClosure of(Model model, ServiceShape service) {
        if (BY_SERVICE.containsKey(service.getId())) {
            return BY_SERVICE.get(service.getId());
        }
        TopDownIndex topDown = TopDownIndex.of(model);
        ServiceClosure instance = new ServiceClosure(model);
        Set<OperationShape> containedOperations = topDown.getContainedOperations(service);
        instance.operations.addAll(containedOperations);
        instance.scan(containedOperations);
        instance.scanned.clear();

        BY_SERVICE.put(service.getId(), instance);

        return instance;
    }

    public TreeSet<Shape> getStructuralNonErrorShapes() {
        return structures;
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

    private void scan(Shape shape) {
        scan(Collections.singletonList(shape));
    }

    private void scan(Set<OperationShape> shapes) {
        scan(new ArrayList<>(shapes));
    }

    private void scan(Collection<Shape> shapes) {
        for (Shape shape : shapes) {
            if (scanned.contains(shape)) {
                continue;
            }
            scanned.add(shape);
            if (shape.isMemberShape()) {
                MemberShape memberShape = (MemberShape) shape;
                shape = model.expectShape(memberShape.getTarget());
            }

            if (shape.isStructureShape() || shape.isUnionShape()) {
                if (shape.hasTrait(ErrorTrait.class)) {
                    errors.add(shape);
                } else {
                    structures.add(shape);
                }

                if (shape instanceof StructureShape structureShape) {
                    structureShape.getAllMembers().values().forEach(this::scan);
                } else if (shape instanceof UnionShape unionShape) {
                    unionShape.getAllMembers().values().forEach(this::scan);
                }
            }

            if (shape.isEnumShape() || shape.isIntEnumShape() || shape.hasTrait(EnumTrait.class)) {
                enums.add(shape);
            }

            if (shape.isListShape()) {
                ListShape listShape = (ListShape) shape;
                scan(listShape.getMember());
            }
            if (shape.isMapShape()) {
                MapShape mapShape = (MapShape) shape;
                scan(mapShape.getKey());
                scan(mapShape.getValue());
            }

            if (shape.isOperationShape()) {
                OperationShape operation = (OperationShape) shape;
                if (operation.getInput().isPresent()) {
                    scan(model.expectShape(operation.getInputShape()));
                }
                if (operation.getOutput().isPresent()) {
                    scan(model.expectShape(operation.getOutputShape()));
                }
            }
        }
    }
}
