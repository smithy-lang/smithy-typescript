/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

package software.amazon.smithy.typescript.codegen;

import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.traits.DocumentationTrait;
import software.amazon.smithy.model.traits.PaginatedTrait;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
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
        ProtocolGenerator protocolGenerator,
        TypeScriptWriter writer,
        TypeScriptWriter modelIndexer
    ) {
        writer.write("/* eslint-disable */");
        settings
            .getService(model)
            .getTrait(DocumentationTrait.class)
            .ifPresent(trait -> writer.writeDocs(trait.getValue() + "\n\n" + "@packageDocumentation"));

        if (settings.generateClient()) {
            writeClientExports(settings, model, symbolProvider, writer);
        }

        if (settings.generateServerSdk() && protocolGenerator != null) {
            writeProtocolExports(protocolGenerator, writer);
            writer.write("export * from \"./server/index\";");
        }

        // write export statement for models
        writer.write(
            // the header comment is already present in the upper writer.
            modelIndexer.toString().replace("// smithy-typescript generated code", "")
        );
    }

    private static void writeProtocolExports(ProtocolGenerator protocolGenerator, TypeScriptWriter writer) {
        String protocolName = ProtocolGenerator.getSanitizedName(protocolGenerator.getName());
        writer.write("export * as $L from \"./protocols/$L\";", protocolName, protocolName);
    }

    static void writeServerIndex(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        FileManifest fileManifest
    ) {
        TypeScriptWriter writer = new TypeScriptWriter("");
        ServiceShape service = settings.getService(model);
        Symbol symbol = symbolProvider.toSymbol(service);

        // Write export statement for operations.
        writer.write("export * from \"./operations\";");

        writer.write("export * from \"./$L\"", symbol.getName());
        fileManifest.writeFile(
            Paths.get(CodegenUtils.SOURCE_FOLDER, ServerSymbolVisitor.SERVER_FOLDER, "index.ts").toString(),
            writer.toString()
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
        writer.write("export { ClientInputEndpointParameters } from \"./endpoint/EndpointParameters\";");

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
        if (SchemaGenerationAllowlist.allows(service.getId(), settings)) {
            writer.write(
                """
                export * from "./schemas/schemas_0";"""
            );
        }

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
