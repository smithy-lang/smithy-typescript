/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.integration;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.StreamingTrait;

@ExtendWith(MockitoExtension.class)
class EventStreamGeneratorTest {

    @Test
    void getEventStreamMember(
        @Mock ProtocolGenerator.GenerationContext context,
        @Mock Model model,
        @Mock StructureShape struct,
        @Mock MemberShape eventStreamMember1,
        @Mock ShapeId streamingMember1ShapeId,
        @Mock UnionShape streamingTarget1
    ) {
        when(struct.members()).thenReturn(List.of(eventStreamMember1));
        when(eventStreamMember1.getTarget()).thenReturn(streamingMember1ShapeId);
        when(context.getModel()).thenReturn(model);
        when(model.expectShape(streamingMember1ShapeId)).thenReturn(streamingTarget1);

        when(streamingTarget1.hasTrait(StreamingTrait.class)).thenReturn(true);
        when(streamingTarget1.isUnionShape()).thenReturn(true);

        MemberShape eventStreamMember = EventStreamGenerator.getEventStreamMember(context, struct);

        assertEquals(eventStreamMember1, eventStreamMember);
    }

    @Test
    void getEventStreamMemberTooFew(@Mock ProtocolGenerator.GenerationContext context, @Mock StructureShape struct) {
        when(struct.members()).thenReturn(List.of());
        when(struct.getId()).thenReturn(ShapeId.from("namespace#Shape"));

        try {
            MemberShape eventStreamMember = EventStreamGenerator.getEventStreamMember(context, struct);
        } catch (CodegenException e) {
            assertEquals("No event stream member found in " + struct.getId().toString(), e.getMessage());
        }
    }

    @Test
    void getEventStreamMemberTooMany(
        @Mock ProtocolGenerator.GenerationContext context,
        @Mock Model model,
        @Mock StructureShape struct,
        @Mock MemberShape eventStreamMember1,
        @Mock ShapeId streamingMember1ShapeId,
        @Mock UnionShape streamingTarget1,
        @Mock MemberShape eventStreamMember2,
        @Mock ShapeId streamingMember2ShapeId,
        @Mock UnionShape streamingTarget2
    ) {
        when(struct.members()).thenReturn(List.of(eventStreamMember1, eventStreamMember2));
        when(context.getModel()).thenReturn(model);
        when(struct.getId()).thenReturn(ShapeId.from("namespace#Shape"));

        when(eventStreamMember1.getTarget()).thenReturn(streamingMember1ShapeId);
        when(model.expectShape(streamingMember1ShapeId)).thenReturn(streamingTarget1);
        when(streamingTarget1.hasTrait(StreamingTrait.class)).thenReturn(true);
        when(streamingTarget1.isUnionShape()).thenReturn(true);

        when(eventStreamMember2.getTarget()).thenReturn(streamingMember2ShapeId);
        when(model.expectShape(streamingMember2ShapeId)).thenReturn(streamingTarget2);
        when(streamingTarget2.hasTrait(StreamingTrait.class)).thenReturn(true);
        when(streamingTarget2.isUnionShape()).thenReturn(true);

        try {
            MemberShape eventStreamMember = EventStreamGenerator.getEventStreamMember(context, struct);
        } catch (CodegenException e) {
            assertEquals("More than one event stream member in " + struct.getId().toString(), e.getMessage());
        }
    }
}
