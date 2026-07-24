/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;

public class ServerGeneratorMetricsTest {

    private Model model;
    private ServiceShape service;
    private SymbolProvider symbolProvider;

    @BeforeEach
    public void setup() {
        model = Model.assembler()
            .addImport(getClass().getResource("output-structure.smithy"))
            .assemble()
            .unwrap();
        service = model.expectShape(ShapeId.from("smithy.example#Example"), ServiceShape.class);
        TypeScriptSettings settings = TypeScriptSettings.from(
            model,
            Node.objectNodeBuilder()
                .withMember("service", Node.from("smithy.example#Example"))
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build()
        );
        symbolProvider = new ServerSymbolVisitor(model, new SymbolVisitor(model, settings));
    }

    private String generateOperationHandler() {
        OperationShape operation = model.expectShape(ShapeId.from("smithy.example#GetFoo"), OperationShape.class);
        TypeScriptWriter writer = new TypeScriptWriter("./GetFoo");
        ServerGenerator
            .generateOperationHandler(symbolProvider, service, operation, writer, false, "eventStreamSerdeProvider");
        return writer.toString();
    }

    private String generateServiceHandler() {
        TypeScriptWriter writer = new TypeScriptWriter("./Example");
        ServerGenerator.generateServiceHandler(
            symbolProvider,
            service,
            model.getOperationShapes(),
            writer,
            false,
            "eventStreamSerdeProvider"
        );
        return writer.toString();
    }

    @Test
    public void emitsWithMetricsRegistrationAndRecorderImports() {
        String generated = generateOperationHandler();
        assertThat(
            generated,
            containsString("withMetrics<Native>(metricsRecorderFactory: __MetricsRecorderFactory<Native>): this")
        );
        assertThat(generated, containsString("MetricsRecorder as __MetricsRecorder"));
        assertThat(generated, containsString("MetricsRecorderFactory as __MetricsRecorderFactory"));
        assertThat(generated, containsString("recordSafely as __recordSafely"));
        assertThat(generated, containsString("recordTimed as __recordTimed"));
        assertThat(generated, containsString("recordTimedSync as __recordTimedSync"));
    }

    @Test
    public void emitsRequestLifecycleWithBeginOutcomeAndEndInFinally() {
        String generated = generateOperationHandler();
        assertThat(generated, containsString("safeRecord((r) => r.begin());"));
        assertThat(generated, containsString("const __metricsStart = performance.now();"));
        assertThat(generated, containsString("} finally {"));
        assertThat(
            generated,
            containsString(
                "safeRecord((r) => r.recordRequestOutcome("
                    + "error === undefined ? \"Success\" : \"Fault\", performance.now() - __metricsStart));"
            )
        );
        assertThat(generated, containsString("safeRecord((r) => r.end());"));
    }

    @Test
    public void emitsExceptionTaxonomyCountsAndOperationProperty() {
        String generated = generateOperationHandler();
        assertThat(generated, containsString("safeRecord((r) => r.setProperty(\"Operation\", operation!));"));
        assertThat(
            generated,
            containsString("safeRecord((r) => r.addCount(\"Error\", metricsErrorClass === \"Error\" ? 1 : 0));")
        );
        assertThat(
            generated,
            containsString(
                "safeRecord((r) => r.addCount(\"Fault\", "
                    + "metricsErrorClass === \"Fault\" || metricsErrorClass === \"Failure\" ? 1 : 0));"
            )
        );
        assertThat(
            generated,
            containsString("safeRecord((r) => r.addCount(\"Failure\", metricsErrorClass === \"Failure\" ? 1 : 0));")
        );
        assertThat(generated, containsString("metricsErrorClass = \"Error\";"));
        assertThat(generated, containsString("metricsErrorClass = \"Fault\";"));
        assertThat(generated, containsString("metricsErrorClass = \"Failure\";"));
    }

    @Test
    public void emitsPhaseTimingsAroundFrameworkSteps() {
        String generated = generateOperationHandler();
        assertThat(generated, containsString("timed(\"DeserializationTime\", async () => {"));
        assertThat(generated, containsString("timedSync(\"ValidationTime\", () => {"));
        assertThat(generated, containsString("timed(\"ActivityTime\", () => this.operation("));
        assertThat(generated, containsString("timed(\"SerializationTime\", () => this.serializer.serialize("));
    }

    @Test
    public void serviceHandlerEmitsSameMetricsWiring() {
        String generated = generateServiceHandler();
        assertThat(
            generated,
            containsString("withMetrics<Native>(metricsRecorderFactory: __MetricsRecorderFactory<Native>): this")
        );
        assertThat(generated, containsString("safeRecord((r) => r.begin());"));
        assertThat(generated, containsString("timed(\"ActivityTime\", () => (this.service["));
        assertThat(generated, containsString("safeRecord((r) => r.end());"));
    }
}
