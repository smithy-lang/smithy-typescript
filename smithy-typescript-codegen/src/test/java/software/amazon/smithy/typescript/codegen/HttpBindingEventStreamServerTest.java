/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.HttpBinding;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.TimestampFormatTrait.Format;
import software.amazon.smithy.typescript.codegen.integration.HttpBindingProtocolGenerator;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator.GenerationContext;

public class HttpBindingEventStreamServerTest {

    /**
     * A minimal concrete {@link HttpBindingProtocolGenerator} for exercising the shared
     * server-side generation paths. Document-body serde is stubbed because event stream
     * payloads are handled through the payload/event-stream path, not document bodies.
     */
    private static final class TestHttpBindingProtocolGenerator extends HttpBindingProtocolGenerator {
        TestHttpBindingProtocolGenerator() {
            super(false);
        }

        @Override
        public ShapeId getProtocol() {
            return ShapeId.from("smithy.example#fakeProtocol");
        }

        @Override
        public void generateProtocolTests(GenerationContext context) {}

        @Override
        protected Format getDocumentTimestampFormat() {
            return Format.EPOCH_SECONDS;
        }

        @Override
        protected String getDocumentContentType() {
            return "application/json";
        }

        @Override
        protected void generateDocumentBodyShapeSerializers(GenerationContext context, Set<Shape> shapes) {}

        @Override
        protected void generateDocumentBodyShapeDeserializers(GenerationContext context, Set<Shape> shapes) {}

        @Override
        protected void serializeInputDocumentBody(
            GenerationContext context,
            OperationShape operation,
            List<HttpBinding> documentBindings
        ) {}

        @Override
        protected void serializeInputEventDocumentPayload(GenerationContext context) {}

        @Override
        protected void serializeOutputDocumentBody(
            GenerationContext context,
            OperationShape operation,
            List<HttpBinding> documentBindings
        ) {}

        @Override
        protected void serializeErrorDocumentBody(
            GenerationContext context,
            StructureShape error,
            List<HttpBinding> documentBindings
        ) {}

        @Override
        protected void writeErrorCodeParser(GenerationContext context) {}

        @Override
        protected void deserializeInputDocumentBody(
            GenerationContext context,
            OperationShape operation,
            List<HttpBinding> documentBindings
        ) {}

        @Override
        protected void deserializeOutputDocumentBody(
            GenerationContext context,
            OperationShape operation,
            List<HttpBinding> documentBindings
        ) {}

        @Override
        protected void deserializeErrorDocumentBody(
            GenerationContext context,
            StructureShape error,
            List<HttpBinding> documentBindings
        ) {}

        @Override
        protected boolean requiresNumericEpochSecondsInPayload() {
            return false;
        }
    }

    private GenerationContext serverContext() {
        Model model = Model.assembler(getClass().getClassLoader())
            .discoverModels(getClass().getClassLoader())
            .addImport(getClass().getResource("server-event-stream-http.smithy"))
            .assemble()
            .unwrap();
        ServiceShape service = model.expectShape(ShapeId.from("smithy.example#Example"), ServiceShape.class);
        TypeScriptSettings settings = TypeScriptSettings.from(
            model,
            Node.objectNodeBuilder()
                .withMember("service", Node.from("smithy.example#Example"))
                .withMember("package", Node.from("example-ssdk"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .withMember("disableDefaultValidation", Node.from(true))
                .build()
        );
        GenerationContext context = new GenerationContext();
        context.setModel(model);
        context.setService(service);
        context.setSettings(settings);
        context.setSymbolProvider(new SymbolVisitor(model, settings));
        context.setProtocolName("fakeProtocol");
        context.setWriter(new TypeScriptWriter("./Publish"));
        return context;
    }

    @Test
    public void responseSerializerUsesTypedEventStreamContext() {
        GenerationContext context = serverContext();
        new TestHttpBindingProtocolGenerator().generateResponseSerializers(context);
        String generated = context.getWriter().toString();
        // The response serializer's serde context must be typed with __EventStreamSerdeContext
        // rather than the previous `& any` escape hatch.
        assertThat(generated, containsString("ctx: ServerSerdeContext & __EventStreamSerdeContext"));
        assertThat(generated, not(containsString("unsupported in ssdk")));
        assertThat(generated, not(containsString("& any")));
    }

    @Test
    public void requestDeserializerUsesTypedEventStreamContext() {
        GenerationContext context = serverContext();
        new TestHttpBindingProtocolGenerator().generateRequestDeserializers(context);
        String generated = context.getWriter().toString();
        // The request deserializer's serde context must include __EventStreamSerdeContext
        // for operations with an event stream input.
        assertThat(generated, containsString("__EventStreamSerdeContext"));
        assertThat(generated, not(containsString("& any")));
    }
}
