/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.schema;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.knowledge.ServiceClosure;
import software.amazon.smithy.typescript.codegen.util.StringStore;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generates typed application facades for a schema-based server.
 */
@SmithyInternalApi
public final class SchemaServerGenerator {

    private static final ShapeId RPC_V2_CBOR = ShapeId.from("smithy.protocols#rpcv2Cbor");
    private static final ShapeId AWS_JSON_1_0 = ShapeId.from("aws.protocols#awsJson1_0");
    private static final ShapeId AWS_JSON_1_1 = ShapeId.from("aws.protocols#awsJson1_1");
    private static final ShapeId REST_JSON_1 = ShapeId.from("aws.protocols#restJson1");
    private static final List<ShapeId> DEFAULT_PROTOCOL_ORDER = List.of(
        RPC_V2_CBOR,
        AWS_JSON_1_0,
        AWS_JSON_1_1,
        REST_JSON_1
    );

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
     * Generates the service operation list, typed options, modeled protocol
     * defaults, and create&lt;Service&gt;Handler factory.
     */
    public void generate() {
        Set<OperationShape> operations = new TreeSet<>(
            TopDownIndex.of(model).getContainedOperations(service)
        );
        List<ProtocolDefault> protocolDefaults = resolveProtocolDefaults();

        writeImports(operations, protocolDefaults);
        writeOperationSchemas(operations);
        writeProtocolDefaults(protocolDefaults);
        writeHandlerOptions(operations, !protocolDefaults.isEmpty());
        writeServiceFactory(!protocolDefaults.isEmpty());
    }

    private void writeImports(Set<OperationShape> operations, List<ProtocolDefault> protocolDefaults) {
        writer.addImport("SchemaServiceHandler", null, TypeScriptDependency.SERVER_COMMON);
        writer.addTypeImport("RequestIdentity", null, TypeScriptDependency.SERVER_COMMON);
        writer.addTypeImport("SchemaServiceHandlerOptions", null, TypeScriptDependency.SERVER_COMMON);
        writer.addTypeImport("ServerOperation", null, TypeScriptDependency.SERVER_COMMON);
        writer.addTypeImport("StaticOperationSchema", null, TypeScriptDependency.SMITHY_TYPES);

        for (ProtocolDefault protocolDefault : protocolDefaults) {
            writer.addImport(protocolDefault.className(), null, TypeScriptDependency.SERVER_COMMON);
        }

        Path schemasPath = Paths.get(".", "src", "schemas", "schemas_0");
        Path modelsPath = Paths.get(".", "src", "models", "models_0");

        for (OperationShape operation : operations) {
            writer.addRelativeImport(getOperationSchemaVariableName(operation), null, schemasPath);
            writer.addRelativeTypeImport(
                symbolProvider.toSymbol(model.expectShape(operation.getInputShape())).getName(),
                null,
                modelsPath
            );
            writer.addRelativeTypeImport(
                symbolProvider.toSymbol(model.expectShape(operation.getOutputShape())).getName(),
                null,
                modelsPath
            );
        }
        writer.write("");
    }

    private void writeOperationSchemas(Set<OperationShape> operations) {
        writer.openBlock("const OPERATION_SCHEMAS: StaticOperationSchema[] = [", "];", () -> {
            for (OperationShape operation : operations) {
                writer.write("$L,", getOperationSchemaVariableName(operation));
            }
        });
        writer.write("");
    }

    private void writeProtocolDefaults(List<ProtocolDefault> protocolDefaults) {
        if (protocolDefaults.isEmpty()) {
            return;
        }

        writer.openBlock("const createGeneratedProtocolDefaults = () => [", "];", () -> {
            for (ProtocolDefault protocolDefault : protocolDefaults) {
                writer.write("new $L($L),", protocolDefault.className(), protocolDefault.constructorOptions());
            }
        });
        writer.write("");
    }

    private void writeHandlerOptions(Set<OperationShape> operations, boolean hasProtocolDefaults) {
        String serviceName = service.getId().getName();
        writer.openBlock(
            "export type $LHandlerOptions<",
            "> = Omit<",
            serviceName,
            () -> {
                writer.write("Identity extends RequestIdentity = RequestIdentity,");
                writer.write("MetricsNative = unknown,");
            }
        );
        writer.indent();
        writer.write("SchemaServiceHandlerOptions<Identity, MetricsNative>,");
        writer.write("$S | $S | $S", "handlers", "operationSchemas", "protocols");
        writer.dedent();
        writer.openBlock("> & {", "};", () -> {
            writer.openBlock("handlers: {", "};", () -> {
                for (OperationShape operation : operations) {
                    String operationName = operation.getId().getName();
                    String inputName = symbolProvider.toSymbol(
                        model.expectShape(operation.getInputShape())
                    ).getName();
                    String outputName = symbolProvider.toSymbol(
                        model.expectShape(operation.getOutputShape())
                    ).getName();
                    writer.write(
                        "$L: ServerOperation<$L, $L, Identity, MetricsNative>;",
                        operationName,
                        inputName,
                        outputName
                    );
                }
            });
            writer.write(
                "protocols$L: SchemaServiceHandlerOptions<Identity, MetricsNative>[$S];",
                hasProtocolDefaults ? "?" : "",
                "protocols"
            );
        });
        writer.write("");
    }

    private void writeServiceFactory(boolean hasProtocolDefaults) {
        String serviceName = service.getId().getName();
        writer.writeDocs("""
                         Creates the schema-based service handler for %s.

                         Generated operation schemas and modeled protocol defaults are supplied by
                         this facade. Applications provide business handlers and optional runtime
                         configuration.
                         """.formatted(serviceName));
        writer.write("export function create$LHandler<", serviceName);
        writer.indent();
        writer.write("Identity extends RequestIdentity = RequestIdentity,");
        writer.write("MetricsNative = unknown,");
        writer.dedent();
        writer.write(">(");
        writer.indent();
        writer.write("options: $LHandlerOptions<Identity, MetricsNative>", serviceName);
        writer.dedent();
        writer.openBlock("): SchemaServiceHandler<Identity, MetricsNative> {", "}", () -> {
            writer.write("const { protocols, ...runtimeOptions } = options;");
            writer.openBlock("return new SchemaServiceHandler<Identity, MetricsNative>({", "});", () -> {
                writer.write("...runtimeOptions,");
                writer.write(
                    "validationEnabled: runtimeOptions.validationEnabled ?? $L,",
                    !settings.isDisableDefaultValidation()
                );
                writer.write("operationSchemas: OPERATION_SCHEMAS,");
                if (hasProtocolDefaults) {
                    writer.write("protocols: protocols ?? createGeneratedProtocolDefaults(),");
                } else {
                    writer.write("protocols,");
                }
            });
        });
    }

    private List<ProtocolDefault> resolveProtocolDefaults() {
        Set<ShapeId> modeledProtocols = ServiceIndex.of(model).getProtocols(service).keySet();
        LinkedHashSet<ShapeId> orderedProtocols = new LinkedHashSet<>();

        if (settings.getProtocol() != null && modeledProtocols.contains(settings.getProtocol())) {
            orderedProtocols.add(settings.getProtocol());
        }

        List<ShapeId> configuredPriority = settings
            .getProtocolPriority()
            .getProtocolPriority(service.getId());
        if (configuredPriority != null) {
            for (ShapeId protocol : configuredPriority) {
                if (modeledProtocols.contains(protocol)) {
                    orderedProtocols.add(protocol);
                }
            }
        }

        for (ShapeId protocol : DEFAULT_PROTOCOL_ORDER) {
            if (modeledProtocols.contains(protocol)) {
                orderedProtocols.add(protocol);
            }
        }

        modeledProtocols
            .stream()
            .sorted()
            .forEach(orderedProtocols::add);

        List<ProtocolDefault> defaults = new ArrayList<>();
        for (ShapeId protocol : orderedProtocols) {
            ProtocolDefault protocolDefault = createProtocolDefault(protocol);
            if (protocolDefault != null) {
                defaults.add(protocolDefault);
            }
        }
        return defaults;
    }

    private ProtocolDefault createProtocolDefault(ShapeId protocol) {
        String namespaceOption = "{ defaultNamespace: \"" + service.getId().getNamespace() + "\" }";
        if (protocol.equals(RPC_V2_CBOR)) {
            return new ProtocolDefault("SmithyRpcV2CborServerProtocol", namespaceOption);
        }
        if (protocol.equals(AWS_JSON_1_0)) {
            return new ProtocolDefault("AwsJsonRpcServerProtocol", namespaceOption);
        }
        if (protocol.equals(AWS_JSON_1_1)) {
            return new ProtocolDefault(
                "AwsJsonRpcServerProtocol",
                "{ defaultNamespace: \""
                    + service.getId().getNamespace()
                    + "\", isVersion1_1: true }"
            );
        }
        if (protocol.equals(REST_JSON_1)) {
            return new ProtocolDefault("AwsRestJsonServerProtocol", namespaceOption);
        }
        return null;
    }

    private String getOperationSchemaVariableName(OperationShape operation) {
        return closure.getShapeSchemaVariableName(operation, store);
    }

    private record ProtocolDefault(String className, String constructorOptions) {}
}
