/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.protocols.sse;

import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.traits.AbstractTrait;
import software.amazon.smithy.model.traits.AnnotationTrait;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * An HTTP protocol that serializes structures as JSON and frames event streams
 * as Server-Sent Events (text/event-stream).
 */
@SmithyUnstableApi
public final class SseJsonTrait extends AnnotationTrait {

    public static final ShapeId ID = ShapeId.from("smithy.typescript.protocols#sseJson");

    public SseJsonTrait(ObjectNode node) {
        super(ID, node);
    }

    public SseJsonTrait() {
        this(Node.objectNode());
    }

    public static final class Provider extends AbstractTrait.Provider {
        public Provider() {
            super(ID);
        }

        @Override
        public SseJsonTrait createTrait(ShapeId target, Node node) {
            return new SseJsonTrait(node.expectObjectNode());
        }
    }
}
