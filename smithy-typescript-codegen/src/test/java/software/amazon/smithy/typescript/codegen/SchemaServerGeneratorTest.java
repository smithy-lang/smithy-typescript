/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.typescript.codegen.schema.SchemaGenerationAllowlist;
import software.amazon.smithy.typescript.codegen.schema.SchemaServerGenerator;

public class SchemaServerGeneratorTest {

    @Test
    public void serverSchemaModeIsUnconditionalAndGeneratesConstructorFacade() {
        Model model = Model.assembler()
            .discoverModels()
            .addUnparsedModel(
                "test.smithy",
                """
                $version: "2"
                namespace example

                use smithy.protocols#rpcv2Cbor

                @rpcv2Cbor
                service ExampleService {
                    version: "1"
                    operations: [Echo]
                }

                operation Echo {
                    input := { value: String }
                    output := { value: String }
                }
                """
            )
            .assemble()
            .unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(
            model,
            Node.objectNodeBuilder()
                .withMember("service", Node.from("example#ExampleService"))
                .withMember("package", Node.from("example-server"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build(),
            TypeScriptSettings.ArtifactType.SSDK
        );
        ServiceShape service = model.expectShape(
            ShapeId.from("example#ExampleService"),
            ServiceShape.class
        );
        SymbolProvider symbolProvider = new ServerSymbolVisitor(
            model,
            new SymbolVisitor(model, settings)
        );
        TypeScriptWriter writer = new TypeScriptWriter("./ExampleServiceHandler");

        new SchemaServerGenerator(model, service, settings, symbolProvider, writer).generate();

        String generated = writer.toString();
        assertTrue(SchemaGenerationAllowlist.allows(service.getId(), settings));
        assertThat(generated, containsString("export type ExampleServiceHandlerOptions<"));
        assertThat(generated, containsString("Echo: ServerOperation<EchoInput, EchoOutput, Identity, MetricsNative>;"));
        assertThat(generated, containsString("export function createExampleServiceHandler<"));
        assertThat(generated, containsString("return new SchemaServiceHandler<Identity, MetricsNative>({"));
        assertThat(
            generated,
            containsString("validationEnabled: runtimeOptions.validationEnabled ?? true,")
        );
        assertThat(generated, containsString("operationSchemas: OPERATION_SCHEMAS,"));
        assertThat(
            generated,
            containsString(
                "new SmithyRpcV2CborServerProtocol({ defaultNamespace: \"example\" })"
            )
        );
        assertThat(generated, not(containsString("class ExampleServiceHandler")));
    }

    @Test
    public void requiresProtocolsWhenNoRuntimeDefaultExists() {
        Model model = Model.assembler()
            .addUnparsedModel(
                "test.smithy",
                """
                $version: "2"
                namespace example

                use smithy.api#protocolDefinition
                use smithy.api#trait

                @trait(selector: "service")
                @protocolDefinition
                structure customProtocol {}

                @customProtocol
                service CustomService {
                    version: "1"
                    operations: [Echo]
                }

                operation Echo {
                    input := { value: String }
                    output := { value: String }
                }
                """
            )
            .assemble()
            .unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(
            model,
            Node.objectNodeBuilder()
                .withMember("service", Node.from("example#CustomService"))
                .withMember("package", Node.from("custom-server"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build(),
            TypeScriptSettings.ArtifactType.SSDK
        );
        ServiceShape service = model.expectShape(
            ShapeId.from("example#CustomService"),
            ServiceShape.class
        );
        SymbolProvider symbolProvider = new ServerSymbolVisitor(
            model,
            new SymbolVisitor(model, settings)
        );
        TypeScriptWriter writer = new TypeScriptWriter("./CustomServiceHandler");

        new SchemaServerGenerator(model, service, settings, symbolProvider, writer).generate();

        String generated = writer.toString();
        assertThat(
            generated,
            containsString(
                "protocols: SchemaServiceHandlerOptions<Identity, MetricsNative>[\"protocols\"];"
            )
        );
        assertThat(generated, not(containsString("createGeneratedProtocolDefaults")));
    }
}
