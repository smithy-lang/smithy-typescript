/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.protocols;

import java.util.Set;
import java.util.TreeSet;
import software.amazon.smithy.model.knowledge.NeighborProviderIndex;
import software.amazon.smithy.model.neighbor.Walker;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeVisitor;
import software.amazon.smithy.protocoltests.traits.HttpMalformedRequestTestCase;
import software.amazon.smithy.protocoltests.traits.HttpMessageTestCase;
import software.amazon.smithy.typescript.codegen.HttpProtocolTestGenerator;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
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

    public static void generateProtocolTests(ProtocolGenerator generator, ProtocolGenerator.GenerationContext context) {
        new HttpProtocolTestGenerator(context,
                generator,
                SmithyProtocolUtils::filterProtocolTests,
                SmithyProtocolUtils::filterMalformedRequestTests).run();
    }

    private static boolean filterProtocolTests(
            ServiceShape service,
            OperationShape operation,
            HttpMessageTestCase testCase,
            TypeScriptSettings settings
    ) {
        if (testCase.getTags().contains("defaults")) {
            return true;
        }

        // TODO(cbor): enable this test when upgrading to a Smithy version
        // TODO(cbor): in which it is fixed.
        if (testCase.getId().equals("RpcV2CborDeserializesDenseSetMapAndSkipsNull")) {
            return true;
        }

        // TODO(cbor): enable test when it's working with vitest 3.x
        if (settings.generateSchemas()
                && (testCase.getId().equals("RpcV2CborInvalidGreetingError")
                        || testCase.getId().equals("RpcV2CborComplexError")
                        || testCase.getId().equals("RpcV2CborEmptyComplexError"))) {
            return true;
        }

        return false;
    }

    private static boolean filterMalformedRequestTests(
            ServiceShape service,
            OperationShape operation,
            HttpMalformedRequestTestCase testCase,
            TypeScriptSettings settings
    ) {
        // Handling overflow/underflow of longs in JS is extraordinarily tricky.
        // Numbers are actually all 62-bit floats, and so any integral number is
        // limited to 53 bits. In typical JS fashion, a value outside of this
        // range just kinda silently bumbles on in some third state between valid
        // and invalid. Infuriatingly, there doesn't seem to be a consistent way
        // to detect this. We could *try* to do bounds checking, but the constants
        // we use wouldn't necessarily work, so it could work in some environments
        // but not others.
        if (operation.getId().getName().equals("MalformedLong") && testCase.hasTag("underflow/overflow")) {
            return true;
        }

        return false;
    }
}
