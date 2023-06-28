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
import java.util.Set;
import java.util.TreeSet;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.utils.StringUtils;

/**
 * Generates aggregated client for service.
 *
 * <p>This client extends from the bare-bones client and provides named methods
 * for every operation in the service. Using this client means that all
 * operations of a service are considered referenced, meaning they will
 * not be removed by tree-shaking.
 */
@SmithyInternalApi
final class ServiceAggregatedClientGenerator implements Runnable {

    private final TypeScriptSettings settings;
    private final Model model;
    private final ServiceShape service;
    private final SymbolProvider symbolProvider;
    private final TypeScriptWriter writer;
    private final String aggregateClientName;
    private final Symbol serviceSymbol;
    private final ApplicationProtocol applicationProtocol;

    ServiceAggregatedClientGenerator(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            String aggregateClientName,
            TypeScriptWriter writer,
            ApplicationProtocol applicationProtocol
    ) {
        this.settings = settings;
        this.model = model;
        this.service = settings.getService(model);
        this.symbolProvider = symbolProvider;
        this.writer = writer;
        this.aggregateClientName = aggregateClientName;
        this.applicationProtocol = applicationProtocol;
        serviceSymbol = symbolProvider.toSymbol(service);
    }

    @Override
    public void run() {
        TopDownIndex topDownIndex = TopDownIndex.of(model);
        final Set<OperationShape> containedOperations = new TreeSet<>(topDownIndex.getContainedOperations(service));
        writer.openBlock("const commands = {", "}", () -> {
            for (OperationShape operation : containedOperations) {
                Symbol operationSymbol = symbolProvider.toSymbol(operation);
                writer.write("$L,", operationSymbol.getName());
            }
        });

        writer.write("");

        // Generate an aggregated client interface.
        writer.openBlock("export interface $L {", "}", aggregateClientName, () -> {
            for (OperationShape operation : containedOperations) {
                Symbol operationSymbol = symbolProvider.toSymbol(operation);
                Symbol input = operationSymbol.expectProperty("inputType", Symbol.class);
                Symbol output = operationSymbol.expectProperty("outputType", Symbol.class);

                writer.addUseImports(operationSymbol);
                String methodName = StringUtils.uncapitalize(
                        operationSymbol.getName().replaceAll("Command$", "")
                );

                // Generate a multiple overloaded methods for each command.
                writer.writeDocs(
                    "@see {@link " + operationSymbol.getName() + "}"
                );
                writer.write("$L(\n"
                            + "  args: $T,\n"
                            + "  options?: $T,\n"
                            + "): Promise<$T>;", methodName, input, applicationProtocol.getOptionsType(), output);
                writer.write("$L(\n"
                             + "  args: $T,\n"
                             + "  cb: (err: any, data?: $T) => void\n"
                             + "): void;", methodName, input, output);
                writer.write("$L(\n"
                            + "  args: $T,\n"
                            + "  options: $T,\n"
                            + "  cb: (err: any, data?: $T) => void\n"
                            + "): void;", methodName, input, applicationProtocol.getOptionsType(), output);
                writer.write("");
            }
        });

        writer.write("");

        writer.addRelativeImport(
            ServiceBareBonesClientGenerator.getConfigTypeName(serviceSymbol),
            null,
            Paths.get(".", serviceSymbol.getNamespace())
        );

        // Generate the client and extend from the bare-bones client.
        writer.writeShapeDocs(service);
        writer.write("export class $L extends $T implements $L {}",
            aggregateClientName, serviceSymbol, aggregateClientName
        );

        writer.addImport("createAggregatedClient", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
        writer.write("createAggregatedClient(commands, $L);", aggregateClientName);
    }
}
