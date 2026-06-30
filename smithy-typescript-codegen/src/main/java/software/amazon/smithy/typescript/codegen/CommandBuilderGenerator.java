/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.typescript.codegen.endpointsV2.RuleSetParameterFinder;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generates the commandBuilder.ts file.
 *
 * <p>The file contains the higher-order command factory (via makeBuilder),
 * deduplicated endpoint parameter sets, and deduplicated middleware functions.
 */
@SmithyInternalApi
public final class CommandBuilderGenerator {

    static final String COMMAND_BUILDER_FILENAME = "commandBuilder.ts";

    private final TypeScriptSettings settings;
    private final Model model;
    private final ServiceShape service;
    private final SymbolProvider symbolProvider;
    private final List<RuntimeClientPlugin> runtimePlugins;

    // Deduplicated endpoint params (key = code string, value = variable name)
    private final LinkedHashMap<String, String> uniqueEndpointParams = new LinkedHashMap<>();
    // Deduplicated middleware functions (key = code string, value = variable name)
    private final LinkedHashMap<String, String> uniqueMiddlewares = new LinkedHashMap<>();

    // operation shape name -> deduplicated variable name (e.g. "GetNumbers" -> "_ep1")
    private final Map<String, String> operationEndpointParamVar = new HashMap<>();
    // operation shape name -> deduplicated variable name (e.g. "GetNumbers" -> "_mw0")
    private final Map<String, String> operationMiddlewareVar = new HashMap<>();

    private int epCounter = 0;
    private int mwCounter = 0;

    public CommandBuilderGenerator(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        List<RuntimeClientPlugin> runtimePlugins
    ) {
        this.settings = settings;
        this.model = model;
        this.service = settings.getService(model);
        this.symbolProvider = symbolProvider;
        this.runtimePlugins = runtimePlugins;
    }

    /**
     * Collects all operations and deduplicates their endpoint params and middleware.
     */
    public void collectOperations() {
        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> operations = new TreeSet<>(
            Comparator.comparing(op -> symbolProvider.toSymbol(op).getName())
        );
        operations.addAll(topDownIndex.getContainedOperations(service));

        RuleSetParameterFinder parameterFinder = new RuleSetParameterFinder(service);

        for (OperationShape operation : operations) {
            String operationName = operation.toShapeId().getName();

            // Build endpoint params string (only the "more" params beyond commonParams)
            String epCode = buildEndpointParamsCode(parameterFinder, operation);
            String epVar = uniqueEndpointParams.computeIfAbsent(epCode, k -> "_ep" + epCounter++);
            operationEndpointParamVar.put(operationName, epVar);

            // Build middleware function string
            String mwCode = buildMiddlewareCode(operation);
            String mwVar = uniqueMiddlewares.computeIfAbsent(mwCode, k -> "_mw" + mwCounter++);
            operationMiddlewareVar.put(operationName, mwVar);
        }
    }

    /**
     * Returns the endpoint param variable name for an operation.
     */
    public String getEndpointParamVar(OperationShape operation) {
        return operationEndpointParamVar.get(operation.toShapeId().getName());
    }

    /**
     * Returns the middleware variable name for an operation.
     */
    public String getMiddlewareVar(OperationShape operation) {
        return operationMiddlewareVar.get(operation.toShapeId().getName());
    }

    /**
     * Generates the commandBuilder.ts file content.
     */
    public void generate(TypeScriptDelegator delegator) {
        delegator.useFileWriter(
            Paths.get(CodegenUtils.SOURCE_FOLDER, COMMAND_BUILDER_FILENAME).toString(),
            writer -> generateContent(writer)
        );
    }

    private void generateContent(TypeScriptWriter writer) {

        Symbol serviceSymbol = symbolProvider.toSymbol(service);
        String clientName = serviceSymbol.getName();
        String serviceShapeName = service.toShapeId().getName();
        String configType = ServiceBareBonesClientGenerator.getResolvedConfigTypeName(serviceSymbol);

        writer.addImportSubmodule("makeBuilder", null, TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CLIENT);
        writer.addImportSubmodule(
            "getEndpointPlugin",
            null,
            TypeScriptDependency.SMITHY_CORE,
            SmithyCoreSubmodules.ENDPOINTS
        );

        writer.addRelativeImport(
            "commonParams",
            null,
            Paths.get(".", CodegenUtils.SOURCE_FOLDER, "endpoint/EndpointParameters")
        );

        // Import client-level types for makeBuilder generic params.
        Path servicePath = Paths.get(".", CodegenUtils.SOURCE_FOLDER, clientName);
        writer.addRelativeTypeImport(configType, null, servicePath);
        writer.addRelativeTypeImport("ServiceInputTypes", null, servicePath);
        writer.addRelativeTypeImport("ServiceOutputTypes", null, servicePath);

        collectPluginImports(writer);

        writer.write("");
        writer.writeDocs("@internal");
        writer.write(
            "export const command = makeBuilder<$L, ServiceInputTypes, ServiceOutputTypes>"
                + "(commonParams, $S, $S, getEndpointPlugin);",
            configType,
            serviceShapeName,
            clientName
        );

        writer.write("");
        for (Map.Entry<String, String> entry : uniqueEndpointParams.entrySet()) {
            writer.writeDocs("@internal");
            writer.write("export const $L = $L;", entry.getValue(), entry.getKey());
            writer.write("");
        }

        for (Map.Entry<String, String> entry : uniqueMiddlewares.entrySet()) {
            writer.writeDocs("@internal");
            writer.write("export const $L = $L;", entry.getValue(), entry.getKey());
            writer.write("");
        }
    }

    private String buildEndpointParamsCode(RuleSetParameterFinder parameterFinder, OperationShape operation) {
        Map<String, String> staticContextParamValues = parameterFinder.getStaticContextParamValues(operation);
        Map<String, String> contextParams = parameterFinder.getContextParams(
            model.getShape(operation.getInputShape()).get()
        );
        Map<String, String> operationContextParamValues = parameterFinder.getOperationContextParamValues(operation);

        if (staticContextParamValues.isEmpty() && contextParams.isEmpty() && operationContextParamValues.isEmpty()) {
            return "{}";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("{\n");

        Set<String> paramNames = new java.util.HashSet<>();
        staticContextParamValues.forEach((name, value) -> {
            paramNames.add(name);
            sb.append("  ")
                .append(name)
                .append(": { type: \"staticContextParams\", value: ")
                .append(value)
                .append(" },\n");
        });

        contextParams.forEach((name, memberName) -> {
            if (!paramNames.contains(name)) {
                sb.append("  ")
                    .append(name)
                    .append(": { type: \"contextParams\", name: \"")
                    .append(memberName)
                    .append("\" },\n");
            }
            paramNames.add(name);
        });

        operationContextParamValues.forEach((name, jmesPathForInputInJs) -> {
            sb.append("  ")
                .append(name)
                .append(": { type: \"operationContextParams\", get: (input?: any) => ")
                .append(jmesPathForInputInJs)
                .append(" },\n");
        });

        sb.append("}");
        return sb.toString();
    }

    private String buildMiddlewareCode(OperationShape operation) {
        List<RuntimeClientPlugin> operationPlugins = runtimePlugins
            .stream()
            .filter(plugin -> plugin.matchesOperation(model, service, operation))
            .filter(plugin -> plugin.getPluginFunction().isPresent())
            .collect(Collectors.toList());

        // Build the plugin list body first to check for 'this' usage.
        StringBuilder body = new StringBuilder();
        for (RuntimeClientPlugin plugin : operationPlugins) {
            plugin.getPluginFunction().ifPresent(pluginSymbolRef -> {
                String pluginName = pluginSymbolRef.getAlias();
                String params = buildPluginParams(plugin, operation);
                body.append("  ").append(pluginName).append("(config");
                if (!params.isEmpty()) {
                    body.append(", ").append(params);
                }
                body.append("),\n");
            });
        }

        String bodyStr = body.toString();
        boolean usesThis = bodyStr.contains("this");

        StringBuilder sb = new StringBuilder();
        if (usesThis) {
            sb.append("function(Command: any, cs: any, config: any, o: any) {\n  return [\n");
        } else {
            sb.append("(Command: any, cs: any, config: any, o: any) => [\n");
        }
        sb.append(bodyStr);
        if (usesThis) {
            sb.append("  ];\n}");
        } else {
            sb.append("]");
        }
        return sb.toString();
    }

    private String buildPluginParams(RuntimeClientPlugin plugin, OperationShape operation) {
        Map<String, Object> additionalParams = plugin.getAdditionalPluginFunctionParameters(model, service, operation);
        if (additionalParams == null || additionalParams.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        sb.append("{\n");
        for (Map.Entry<String, Object> entry : additionalParams.entrySet()) {
            sb.append("    ").append(entry.getKey()).append(": ").append(formatValue(entry.getValue())).append(",\n");
        }
        sb.append("  }");
        return sb.toString();
    }

    private String formatValue(Object value) {
        if (value instanceof String) {
            return "\"" + value + "\"";
        } else if (value instanceof Boolean || value instanceof Number) {
            return value.toString();
        } else if (value instanceof List) {
            List<?> list = (List<?>) value;
            return "[" + list.stream().map(this::formatValue).collect(Collectors.joining(", ")) + "]";
        } else if (value instanceof Map) {
            Map<?, ?> map = (Map<?, ?>) value;
            StringBuilder sb = new StringBuilder("{ ");
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                sb.append("\"")
                    .append(entry.getKey())
                    .append("\": ")
                    .append(formatValue(entry.getValue()))
                    .append(", ");
            }
            sb.append("}");
            return sb.toString();
        } else if (value instanceof Symbol) {
            return ((Symbol) value).getName();
        }
        return String.valueOf(value);
    }

    private void collectPluginImports(TypeScriptWriter writer) {
        Set<String> pluginNames = new java.util.HashSet<>();
        TopDownIndex topDownIndex = TopDownIndex.of(model);

        List<software.amazon.smithy.codegen.core.SymbolReference> refs = new ArrayList<>();

        for (OperationShape operation : topDownIndex.getContainedOperations(service)) {
            for (RuntimeClientPlugin plugin : runtimePlugins) {
                if (!plugin.matchesOperation(model, service, operation)) {
                    continue;
                }
                plugin.getPluginFunction().ifPresent(pluginSymbolRef -> {
                    String alias = pluginSymbolRef.getAlias();
                    if (pluginNames.add(alias)) {
                        refs.add(pluginSymbolRef);
                    }
                });
            }
        }

        for (var ref : refs) {
            Symbol sym = ref.getSymbol();
            String from = sym.getNamespace();
            String name = ref.getAlias();
            for (var dep : sym.getDependencies()) {
                writer.addDependency(dep);
            }
            if (from.startsWith("./")) {
                writer.addRelativeImport(name, null, Paths.get(from));
            } else {
                writer.addImport(name, null, from);
            }
        }
    }
}
