/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import java.nio.file.Paths;
import java.util.Set;
import java.util.TreeSet;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.traits.PaginatedTrait;
import software.amazon.smithy.typescript.codegen.knowledge.ServiceClosure;
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.utils.StringUtils;
import software.amazon.smithy.waiters.WaitableTrait;
import software.amazon.smithy.waiters.Waiter;

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
    private final ServiceClosure closure;

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
        serviceSymbol = symbolProvider.toSymbol(service).toBuilder().putProperty("typeOnly", false).build();
        closure = ServiceClosure.of(model, settings.getService(model));
    }

    @Override
    public void run() {
        TopDownIndex topDownIndex = TopDownIndex.of(model);
        final Set<OperationShape> containedOperations = new TreeSet<>(topDownIndex.getContainedOperations(service));

        boolean hasPaginators = !closure.getPaginatedOperationShapes().isEmpty();
        boolean hasWaiters = !closure.getWaitableOperationShapes().isEmpty();

        writer.openBlock("const commands = {");
        for (OperationShape operation : containedOperations) {
            Symbol operationSymbol = symbolProvider
                .toSymbol(operation)
                .toBuilder()
                .putProperty("typeOnly", false)
                .build();
            writer.write("$T,", operationSymbol);
            if (operation.hasTrait(PaginatedTrait.ID)) {
                hasPaginators = true;
            }
            if (operation.hasTrait(WaitableTrait.ID)) {
                hasWaiters = true;
            }
        }
        writer.closeBlock("};");

        if (hasPaginators) {
            writer.openBlock("const paginators = {");
            for (OperationShape operation : closure.getPaginatedOperationShapes()) {
                String paginatorFnName = "paginate" + StringUtils.capitalize(operation.getId().getName());
                writer.addRelativeImport(
                    paginatorFnName,
                    null,
                    Paths.get(
                        ".",
                        CodegenUtils.SOURCE_FOLDER,
                        PaginationGenerator.getOutputFileLocation(operation)
                            .replaceFirst("(.*?)pagination(.*?)\\.ts$", "pagination$2")
                    )
                );
                writer.write("$L,", paginatorFnName);
            }
            writer.closeBlock("};");
        }

        if (hasWaiters) {
            writer.openBlock("const waiters = {");
            for (OperationShape operation : closure.getWaitableOperationShapes()) {
                WaitableTrait waitableTrait = operation.expectTrait(WaitableTrait.class);
                waitableTrait
                    .getWaiters()
                    .forEach((String waiterName, Waiter waiter) -> {
                        String waiterFnName = "waitUntil" + StringUtils.capitalize(waiterName);
                        writer.addRelativeImport(
                            waiterFnName,
                            null,
                            Paths.get(
                                ".",
                                CodegenUtils.SOURCE_FOLDER,
                                WaiterGenerator.getOutputFileLocation(waiterName)
                                    .replaceFirst("(.*?)waiters(.*?)\\.ts$", "waiters$2")
                            )
                        );
                        writer.write("$L,", waiterFnName);
                    });
            }
            writer.closeBlock("};");
        }

        writer.write("");

        // Generate an aggregated client interface.
        writer.openBlock("export interface $L {", "}", aggregateClientName, () -> {
            for (OperationShape operation : containedOperations) {
                Symbol operationSymbol = symbolProvider.toSymbol(operation);
                Symbol input = operationSymbol.expectProperty("inputType", Symbol.class);
                Symbol output = operationSymbol.expectProperty("outputType", Symbol.class);
                writer.addUseImports(operationSymbol);
                String methodName = StringUtils.uncapitalize(operationSymbol.getName().replaceAll("Command$", ""));

                // Generate a multiple overloaded methods for each command.
                writer.writeDocs("@see {@link " + operationSymbol.getName() + "}");
                boolean inputOptional = model
                    .getShape(operation.getInputShape())
                    .map(shape -> shape.getAllMembers().values().stream().noneMatch(MemberShape::isRequired))
                    .orElse(true);
                if (inputOptional) {
                    writer.write("$L(): Promise<$T>;", methodName, output);
                }
                writer.write(
                    """
                    $1L(
                      args: $2T,
                      options?: $3T
                    ): Promise<$4T>;
                    $1L(
                      args: $2T,
                      cb: (err: any, data?: $4T) => void
                    ): void;
                    $1L(
                      args: $2T,
                      options: $3T,
                      cb: (err: any, data?: $4T) => void
                    ): void;""",
                    methodName,
                    input,
                    applicationProtocol.getOptionsType(),
                    output
                );
                writer.write("");
            }

            for (OperationShape operation : closure.getPaginatedOperationShapes()) {
                if (operation.hasTrait(PaginatedTrait.ID)) {
                    String paginatorFnName = "paginate" + StringUtils.capitalize(operation.getId().getName());

                    Symbol operationSymbol = symbolProvider.toSymbol(operation);
                    Symbol input = operationSymbol.expectProperty("inputType", Symbol.class);
                    Symbol output = operationSymbol.expectProperty("outputType", Symbol.class);

                    writer.addTypeImport("Paginator", null, TypeScriptDependency.SMITHY_TYPES);
                    writer.addTypeImport("PaginationConfiguration", null, TypeScriptDependency.SMITHY_TYPES);

                    boolean inputOptional = model
                        .getShape(operation.getInputShape())
                        .map(shape -> shape.getAllMembers().values().stream().noneMatch(MemberShape::isRequired))
                        .orElse(true);

                    String inputOptionality = inputOptional ? "?" : "";

                    writer.writeDocs(
                        """
                        @see {@link %s}
                        @param args - command input.
                        @param paginationConfig - optional pagination config.
                        @returns AsyncIterable of {@link %s}.""".formatted(operationSymbol.getName(), output.getName())
                    );
                    writer.write(
                        """
                        $1L(
                          args$5L: $2T,
                          paginationConfig?: Omit<$3L, "client">
                        ): Paginator<$4T>;
                        """,
                        paginatorFnName,
                        input,
                        "PaginationConfiguration",
                        output,
                        inputOptionality
                    );
                }
            }

            for (OperationShape operation : closure.getWaitableOperationShapes()) {
                if (operation.hasTrait(WaitableTrait.ID)) {
                    WaitableTrait waitableTrait = operation.expectTrait(WaitableTrait.class);

                    Symbol operationSymbol = symbolProvider.toSymbol(operation);
                    Symbol input = operationSymbol.expectProperty("inputType", Symbol.class);

                    // TODO: use this to change WaiterResult to WaiterResult<OutputType>.
                    Symbol output = operationSymbol.expectProperty("outputType", Symbol.class);

                    waitableTrait
                        .getWaiters()
                        .forEach((String waiterName, Waiter waiter) -> {
                            String waiterFnName = "waitUntil" + StringUtils.capitalize(waiterName);

                            writer.addTypeImport("WaiterConfiguration", null, TypeScriptDependency.SMITHY_TYPES);
                            writer.addTypeImport("WaiterResult", null, TypeScriptDependency.AWS_SDK_UTIL_WAITERS);

                            writer.writeDocs(
                                """
                                @see {@link %s}
                                @param args - command input.
                                @param waiterConfig - `maxWaitTime` in seconds or waiter config object."""
                                    .formatted(operationSymbol.getName())
                            );
                            writer.write(
                                """
                                $1L(
                                  args: $2T,
                                  waiterConfig: number | Omit<$3L, "client">
                                ): Promise<WaiterResult>;
                                """,
                                waiterFnName,
                                input,
                                "WaiterConfiguration<" + aggregateClientName + ">"
                            );
                        });
                }
            }

            writer.unwrite("\n");
        });

        writer.write("");

        // Generate the client and extend from the bare-bones client.
        writer.writeShapeDocs(service);
        writer.write(
            "export class $L extends $T implements $L {}",
            aggregateClientName,
            serviceSymbol,
            aggregateClientName
        );

        writer.addImport("createAggregatedClient", null, TypeScriptDependency.AWS_SMITHY_CLIENT);

        if (hasPaginators && hasWaiters) {
            writer.write("createAggregatedClient(commands, $L, { paginators, waiters });", aggregateClientName);
        } else if (hasPaginators) {
            writer.write("createAggregatedClient(commands, $L, { paginators });", aggregateClientName);
        } else if (hasWaiters) {
            writer.write("createAggregatedClient(commands, $L, { waiters });", aggregateClientName);
        } else {
            writer.write("createAggregatedClient(commands, $L);", aggregateClientName);
        }
    }
}
