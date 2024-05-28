/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.protocols;

import java.util.Set;
import java.util.TreeSet;
import software.amazon.smithy.model.knowledge.NeighborProviderIndex;
import software.amazon.smithy.model.neighbor.Walker;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeVisitor;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Utility methods for generating Smithy protocols.
 */
@SmithyInternalApi
public final class SmithyProtocolUtils {

    private SmithyProtocolUtils() {}

    /**
     * Writes a serde function for a set of shapes using the passed visitor.
     * This will walk the input set of shapes and invoke the visitor for any
     * members of aggregate shapes in the set.
     *
     * @see software.amazon.smithy.typescript.codegen.integration.DocumentShapeSerVisitor
     * @see software.amazon.smithy.typescript.codegen.integration.DocumentShapeDeserVisitor
     *
     * @param context The generation context.
     * @param shapes A list of shapes to generate serde for, including their members.
     * @param visitor A ShapeVisitor that generates a serde function for shapes.
     */
    public static void generateDocumentBodyShapeSerde(
        ProtocolGenerator.GenerationContext context,
        Set<Shape> shapes,
        ShapeVisitor<Void> visitor
    ) {
        Walker shapeWalker = new Walker(NeighborProviderIndex.of(context.getModel()).getProvider());
        Set<Shape> shapesToGenerate = new TreeSet<>(shapes);
        shapes.forEach(shape -> shapesToGenerate.addAll(shapeWalker.walkShapes(shape)));
        shapesToGenerate.forEach(shape -> shape.accept(visitor));
    }
}
