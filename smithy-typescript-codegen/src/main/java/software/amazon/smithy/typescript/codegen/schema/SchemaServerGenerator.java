/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.schema;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;
import java.util.TreeSet;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.typescript.codegen.SmithyCoreSubmodules;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.knowledge.ServiceClosure;
import software.amazon.smithy.typescript.codegen.util.StringStore;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generates a schema-based server handler for a service.
 *
 * <p>This generator is protocol-agnostic. It emits a service handler class that
 * delegates to a {@code ServerProtocol} instance for request deserialization and
 * response serialization. The protocol instance is resolved at runtime, enabling
 * protocol selection based on incoming request headers.
 *
 * <p>The generated handler uses operation schemas from the {@link SchemaGenerator}
 * output to drive serde, eliminating per-operation serializer/deserializer functions.
 */
@SmithyInternalApi
public class SchemaServerGenerator {

    private final Model model;
    private final ServiceShape service;
    private final TypeScriptSettings settings;
    private final SymbolProvider symbolProvider;
    private final TypeScriptWriter writer;
    private final ServiceClosure closure;
    private final StringStore store = new StringStore();

    public SchemaServerGenerator(
        Model model,
        ServiceShape service,
        TypeScriptSettings settings,
        SymbolProvider symbolProvider,
        TypeScriptWriter writer
    ) {
        this.model = model;
        this.service = service;
        this.settings = settings;
        this.symbolProvider = symbolProvider;
        this.writer = writer;
        this.closure = ServiceClosure.of(model, service);
    }

    /**
     * Generates the schema-based service handler file.
     * This includes:
     * <ul>
     *     <li>Operation schema imports</li>
     *     <li>A route map from operation name to operation schema</li>
     *     <li>The service handler class that delegates to a ServerProtocol</li>
     * </ul>
     */
    public void generate() {
        Set<OperationShape> operations = new TreeSet<>(
            TopDownIndex.of(model).getContainedOperations(service)
        );

        writeImports(operations);
        writeOperationSchemaMap(operations);
        writeServiceHandler(operations);
    }

    private void writeImports(Set<OperationShape> operations) {
        // Import base class from server-common.
        writer.addImport("SchemaServiceHandler", null, TypeScriptDependency.SERVER_COMMON);
        writer.addTypeImport("SchemaServiceHandlerOptions", null, TypeScriptDependency.SERVER_COMMON);
        writer.addTypeImportSubmodule(
            "HttpRequest",
            null,
            TypeScriptDependency.SMITHY_CORE,
            SmithyCoreSubmodules.PROTOCOLS
        );
        writer.addTypeImportSubmodule(
            "HttpResponse",
            null,
            TypeScriptDependency.SMITHY_CORE,
            SmithyCoreSubmodules.PROTOCOLS
        );
        writer.addTypeImport("StaticOperationSchema", null, TypeScriptDependency.SMITHY_TYPES);

        Path schemasPath = Paths.get(".", "src", "schemas", "schemas_0");
        Path modelsPath = Paths.get(".", "src", "models", "models_0");

        // Import operation schemas from the generated schemas file.
        for (OperationShape operation : operations) {
            String schemaVarName = getOperationSchemaVarName(operation);
            writer.addRelativeImport(schemaVarName, null, schemasPath);
        }

        // Import operation input/output types from models.
        for (OperationShape operation : operations) {
            String inputName = symbolProvider.toSymbol(
                model.expectShape(operation.getInputShape())
            ).getName();
            String outputName = symbolProvider.toSymbol(
                model.expectShape(operation.getOutputShape())
            ).getName();
            writer.addRelativeTypeImport(inputName, null, modelsPath);
            writer.addRelativeTypeImport(outputName, null, modelsPath);
        }
        writer.write("");
    }

    private void writeOperationSchemaMap(Set<OperationShape> operations) {
        writer.openBlock(
            "const OPERATION_SCHEMAS: Record<string, StaticOperationSchema> = {",
            "} as const;",
            () -> {
                for (OperationShape operation : operations) {
                    String opName = operation.getId().getName();
                    String schemaVarName = getOperationSchemaVarName(operation);
                    writer.write("$S: $L,", opName, schemaVarName);
                }
            }
        );
        writer.write("");
    }

    private void writeServiceHandler(Set<OperationShape> operations) {
        String serviceName = service.getId().getName();
        boolean validationEnabled = !settings.isDisableDefaultValidation();

        writer.writeDocs("""
                         Schema-based service handler for %s.
                         Extends SchemaServiceHandler which provides protocol resolution, routing,
                         metrics, auth, and interceptor support.
                         """.formatted(serviceName));
        writer.openBlock(
            "export class $LHandler<Context = {}> extends SchemaServiceHandler<Context> {",
            "}",
            serviceName,
            () -> {
                // Constructor with typed handlers
                writeConstructor(serviceName, operations);

                // getOperationSchemas() override
                writer.openBlock(
                    "protected getOperationSchemas(): Record<string, StaticOperationSchema> {",
                    "}",
                    () -> writer.write("return OPERATION_SCHEMAS;")
                );

                // isValidationEnabled() override if validation is disabled
                if (!validationEnabled) {
                    writer.write("");
                    writer.openBlock(
                        "protected isValidationEnabled(): boolean {",
                        "}",
                        () -> writer.write("return false;")
                    );
                }
            }
        );
    }

    private void writeConstructor(String serviceName, Set<OperationShape> operations) {
        writer.openBlock("constructor(options: {", "}) {", () -> {
            writer.write(
                "protocols: SchemaServiceHandlerOptions<Context>[\"protocols\"];"
            );
            writer.write(
                "handlers: {"
            );
            writer.indent();
            for (OperationShape operation : operations) {
                String opName = operation.getId().getName();
                String inputName = symbolProvider.toSymbol(
                    model.expectShape(operation.getInputShape())
                ).getName();
                String outputName = symbolProvider.toSymbol(
                    model.expectShape(operation.getOutputShape())
                ).getName();
                writer.write(
                    "$L: (input: $L, context: Context) => Promise<$L>;",
                    opName,
                    inputName,
                    outputName
                );
            }
            writer.dedent();
            writer.write("};");
            writer.write("router?: SchemaServiceHandlerOptions<Context>[\"router\"];");
        });
        writer.indent();
        writer.write("super(options);");
        writer.closeBlock("}");
        writer.write("");
    }

    private String getOperationSchemaVarName(OperationShape operation) {
        return closure.getShapeSchemaVariableName(operation, store);
    }
}
