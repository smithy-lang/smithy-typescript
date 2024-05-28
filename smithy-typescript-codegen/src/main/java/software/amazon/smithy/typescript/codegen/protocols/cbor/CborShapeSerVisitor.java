/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.protocols.cbor;

import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.DocumentShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.typescript.codegen.integration.DocumentShapeSerVisitor;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;

public class CborShapeSerVisitor extends DocumentShapeSerVisitor {

    public CborShapeSerVisitor(ProtocolGenerator.GenerationContext context) {
        super(context);
    }

    @Override
    protected void serializeCollection(ProtocolGenerator.GenerationContext context, CollectionShape shape) {

    }

    @Override
    protected void serializeDocument(ProtocolGenerator.GenerationContext context, DocumentShape shape) {

    }

    @Override
    protected void serializeMap(ProtocolGenerator.GenerationContext context, MapShape shape) {

    }

    @Override
    protected void serializeStructure(ProtocolGenerator.GenerationContext context, StructureShape shape) {

    }

    @Override
    protected void serializeUnion(ProtocolGenerator.GenerationContext context, UnionShape shape) {

    }
}
