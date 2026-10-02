/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import java.util.ArrayList;
import java.util.List;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.traits.DocumentationTrait;
import software.amazon.smithy.model.traits.PaginatedTrait;
import software.amazon.smithy.typescript.codegen.schema.SchemaGenerationAllowlist;
import software.amazon.smithy.typescript.codegen.validation.ReplaceLast;
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.waiters.WaitableTrait;

/**
 * Generates an index to export the service client and each command.
 */
@SmithyInternalApi
final class IndexGenerator {

    private IndexGenerator() {}

    static void writeIndex(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        TypeScriptWriter writer,
        TypeScriptWriter modelIndexer
    ) {
        writer.write("/* eslint-disable */");
        settings
            .getOptionalService()
            .map(id -> model.expectShape(id, ServiceShape.class))
            .flatMap(service -> service.getTrait(DocumentationTrait.class))
            .ifPresent(trait -> writer.writeDocs(trait.getValue() + "\n\n" + "@packageDocumentation"));

        if (settings.generateClient()) {
            writeClientExports(settings, model, symbolProvider, writer);
        }

        if (settings.generateServerSdk()) {
            String serviceName = settings.getService(model).getId().getName();
            writer.write("export * from \"./server/$LHandler\";", serviceName);
        }

        if (
            SchemaGenerationAllowlist.allows(
                settings.getOptionalService().orElse(null),
                settings
            )
        ) {
            writer.write(
                """
                export * from "./schemas/schemas_0";"""
            );
        }

        // write export statement for models
        writer.write(
            // the header comment is already present in the upper writer.
            modelIndexer.toString().replace("// smithy-typescript generated code", "")
        );
    }

    private static void writeClientExports(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        TypeScriptWriter writer
    ) {
        ServiceShape service = settings.getService(model);
        Symbol symbol = symbolProvider.toSymbol(service);
        // Normalizes client name, e.g. WeatherClient => Weather
        String normalizedClientName = ReplaceLast.in(symbol.getName(), "Client", "");

        // Write export statement for bare-bones client.
        writer.write("export * from \"./$L\";", symbol.getName());

        // Write export statement for aggregated client.
        writer.write("export * from \"./$L\";", normalizedClientName);

        // export endpoints config interface
        writer.write("export type { ClientInputEndpointParameters } from \"./endpoint/EndpointParameters\";");

        // Export Runtime Extension and Client ExtensionConfiguration interfaces
        writer.write("export type { RuntimeExtension } from \"./runtimeExtensions\";");
        writer.write(
            "export type { $LExtensionConfiguration } from \"./extensionConfiguration\";",
            normalizedClientName
        );

        // Write export statement for commands.
        writer.write(
            """
            export * from "./commands";"""
        );
        writer.write("export { Command as $$Command } from \"@smithy/core/client\";");

        TopDownIndex topDownIndex = TopDownIndex.of(model);
        List<OperationShape> operations = new ArrayList<OperationShape>();
        operations.addAll(topDownIndex.getContainedOperations(service));

        // Export pagination, if present.
        if (operations.stream().anyMatch(operation -> operation.hasTrait(PaginatedTrait.ID))) {
            writer.write("export * from \"./pagination\";");
        }

        // Export waiters, if present.
        if (operations.stream().anyMatch(operation -> operation.hasTrait(WaitableTrait.ID))) {
            writer.write("export * from \"./waiters\";");
        }
    }
}
