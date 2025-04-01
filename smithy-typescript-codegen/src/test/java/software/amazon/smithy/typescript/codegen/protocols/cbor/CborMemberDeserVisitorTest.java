package software.amazon.smithy.typescript.codegen.protocols.cbor;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.BlobShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CborMemberDeserVisitorTest {
    private CborMemberDeserVisitor subject;

    @BeforeEach
    void setup(
        @Mock ProtocolGenerator.GenerationContext context,
        @Mock Model model,
        @Mock TypeScriptWriter typeScriptWriter,
        @Mock TypeScriptSettings settings
    ) {
        when(context.getModel()).thenReturn(model);
        when(context.getWriter()).thenReturn(typeScriptWriter);
        when(context.getSettings()).thenReturn(settings);

        subject = new CborMemberDeserVisitor(
            context,
            "data"
        );
    }

    @Test
    void blobShape(@Mock BlobShape blobShape) {
        // no decoder for blob in cbor.
        assertEquals(
            "data",
            subject.blobShape(
                blobShape
            )
        );
    }

    @Test
    void timestampShape(@Mock TimestampShape timestampShape) {
        // protocol always uses this timestamp format.
        assertEquals(
            "__expectNonNull(__parseEpochTimestamp(data))",
            subject.timestampShape(timestampShape)
        );
    }
}