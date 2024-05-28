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
import software.amazon.smithy.typescript.codegen.integration.DocumentShapeDeserVisitor;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;

public class CborShapeDeserVisitor extends DocumentShapeDeserVisitor {

    public CborShapeDeserVisitor(ProtocolGenerator.GenerationContext context) {
        super(context);
    }

    @Override
    protected void deserializeCollection(ProtocolGenerator.GenerationContext context, CollectionShape shape) {

    }

    @Override
    protected void deserializeDocument(ProtocolGenerator.GenerationContext context, DocumentShape shape) {

    }

    @Override
    protected void deserializeMap(ProtocolGenerator.GenerationContext context, MapShape shape) {

    }

    @Override
    protected void deserializeStructure(ProtocolGenerator.GenerationContext context, StructureShape shape) {

    }

    @Override
    protected void deserializeUnion(ProtocolGenerator.GenerationContext context, UnionShape shape) {

    }
}
