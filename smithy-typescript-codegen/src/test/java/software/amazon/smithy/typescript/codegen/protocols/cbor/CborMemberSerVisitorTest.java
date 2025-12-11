/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.protocols.cbor;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.BlobShape;
import software.amazon.smithy.model.shapes.DoubleShape;
import software.amazon.smithy.model.shapes.FloatShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;

@ExtendWith(MockitoExtension.class)
class CborMemberSerVisitorTest {

    private CborMemberSerVisitor subject;

    @BeforeEach
    void setup(
            @Mock ProtocolGenerator.GenerationContext context,
            @Mock Model model,
            @Mock TypeScriptWriter typeScriptWriter
    ) {
        when(context.getModel()).thenReturn(model);
        lenient().when(context.getWriter()).thenReturn(typeScriptWriter);

        subject = new CborMemberSerVisitor(
                context,
                "data");
    }

    @Test
    void blobShape(@Mock BlobShape blob) {
        // no encoder for blob in cbor.
        assertEquals(
                "data",
                subject.blobShape(blob));
    }

    @Test
    void floatShape(@Mock FloatShape floatShape) {
        // no serializer function for float in cbor.
        assertEquals(
                "data",
                subject.floatShape(floatShape));
    }

    @Test
    void doubleShape(@Mock DoubleShape doubleShape) {
        // no serializer function for double in cbor.
        assertEquals(
                "data",
                subject.doubleShape(doubleShape));
    }

    @Test
    void timestampShape(@Mock TimestampShape timestampShape) {
        assertEquals(
                "__dateToTag(data)",
                subject.timestampShape(timestampShape));
    }
}
