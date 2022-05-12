/*
 * Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.logging.Logger;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.directed.CreateContextDirective;
import software.amazon.smithy.codegen.core.directed.CreateSymbolProviderDirective;
import software.amazon.smithy.codegen.core.directed.DirectedCodegen;
import software.amazon.smithy.codegen.core.directed.GenerateEnumDirective;
import software.amazon.smithy.codegen.core.directed.GenerateErrorDirective;
import software.amazon.smithy.codegen.core.directed.GenerateServiceDirective;
import software.amazon.smithy.codegen.core.directed.GenerateStructureDirective;
import software.amazon.smithy.codegen.core.directed.GenerateUnionDirective;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.traits.PaginatedTrait;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.utils.SmithyUnstableApi;
import software.amazon.smithy.waiters.WaitableTrait;
import software.amazon.smithy.waiters.Waiter;

@SmithyUnstableApi
final class DirectedTypeScriptCodegen implements DirectedCodegen<TypeScriptCodegenContext, TypeScriptSettings, TypeScriptIntegration> {

    private static final Logger LOGGER = Logger.getLogger(DirectedTypeScriptCodegen.class.getName());

    @Override
    public SymbolProvider createSymbolProvider(CreateSymbolProviderDirective<TypeScriptSettings> directive) {
        return new SymbolVisitor(directive.model(), directive.settings());
    }

    @Override
    public TypeScriptCodegenContext createContext(CreateContextDirective<TypeScriptSettings, TypeScriptIntegration> directive) {

        List<RuntimeClientPlugin> runtimePlugins = new ArrayList<>();
        directive.integrations().forEach(integration -> {
            LOGGER.info(() -> "Adding TypeScriptIntegration: " + integration.getClass().getName());
            integration.getClientPlugins().forEach(runtimePlugin -> {
                LOGGER.info(() -> "Adding TypeScript runtime plugin: " + runtimePlugin);
                runtimePlugins.add(runtimePlugin);
            });
        });

        ProtocolGenerator protocolGenerator = resolveProtocolGenerator(
                directive.integrations(),
                directive.model(),
                directive.service(),
                directive.settings());
        ApplicationProtocol applicationProtocol = protocolGenerator == null
                ? ApplicationProtocol.createDefaultHttpApplicationProtocol()
                : protocolGenerator.getApplicationProtocol();

        // TODO: consider taking directive in the constructor and have all the logic there, instead of builder
        return TypeScriptCodegenContext.builder()
                .model(directive.model())
                .settings(directive.settings())
                .symbolProvider(directive.symbolProvider())
                .fileManifest(directive.fileManifest())
                .integrations(directive.integrations())
                .runtimePlugins(runtimePlugins)
                .protocolGenerator(protocolGenerator)
                .applicationProtocol(applicationProtocol)

                //TODO: fix delegator constructor
                .writerDelegator(new TypeScriptDelegator(
                        directive.settings(), directive.model(),
                        directive.fileManifest(), directive.symbolProvider(),
                        directive.integrations())) // TODO: integrations?
                .build();
    }

    private ProtocolGenerator resolveProtocolGenerator(
            Collection<TypeScriptIntegration> integrations,
            Model model,
            ServiceShape service,
            TypeScriptSettings settings
    ) {
        // Collect all of the supported protocol generators.
        Map<ShapeId, ProtocolGenerator> generators = new HashMap<>();
        for (TypeScriptIntegration integration : integrations) {
            for (ProtocolGenerator generator : integration.getProtocolGenerators()) {
                generators.put(generator.getProtocol(), generator);
            }
        }

        ShapeId protocolName;
        try {
            protocolName = settings.resolveServiceProtocol(model, service, generators.keySet());
        } catch (UnresolvableProtocolException e) {
            LOGGER.warning("Unable to find a protocol generator for " + service.getId() + ": " + e.getMessage());
            protocolName = null;
        }

        return protocolName != null ? generators.get(protocolName) : null;
    }

    @Override
    public void generateService(GenerateServiceDirective<TypeScriptCodegenContext, TypeScriptSettings> directive) {
        TypeScriptSettings settings = directive.settings();
        ServiceShape shape = directive.shape();
        TypeScriptDelegator delegator = directive.context().writerDelegator();

        if (settings.generateClient()) {
            generateClient(directive);
        }
        if (settings.generateClient() || settings.generateServerSdk()) {
            generateCommands(directive);
        }

        if (settings.generateServerSdk()) {
            generateServiceInterface(directive);
        }

        ProtocolGenerator protocolGenerator = directive.context().protocolGenerator();
        ServiceShape service = directive.shape();
        Model model = directive.model();
        SymbolProvider symbolProvider = directive.symbolProvider();
        List<TypeScriptIntegration> integrations = directive.context().integrations();
        if (protocolGenerator != null) {
            LOGGER.info("Generating serde for protocol " + protocolGenerator.getName() + " on " + shape.getId());
            String fileName = Paths.get(CodegenUtils.SOURCE_FOLDER, ProtocolGenerator.PROTOCOLS_FOLDER,
                    ProtocolGenerator.getSanitizedName(protocolGenerator.getName()) + ".ts").toString();
            delegator.useFileWriter(fileName, writer -> {
                ProtocolGenerator.GenerationContext context = new ProtocolGenerator.GenerationContext();
                context.setProtocolName(protocolGenerator.getName());
                context.setIntegrations(integrations);
                context.setModel(model);
                context.setService(shape);
                context.setSettings(settings);
                context.setSymbolProvider(symbolProvider);
                context.setWriter(writer);
                if (context.getSettings().generateClient()) {
                    protocolGenerator.generateRequestSerializers(context);
                    protocolGenerator.generateResponseDeserializers(context);
                }
                if (context.getSettings().generateServerSdk()) {
                    ProtocolGenerator.GenerationContext serverContext =
                            context.withSymbolProvider(symbolProvider);
                    protocolGenerator.generateRequestDeserializers(serverContext);
                    protocolGenerator.generateResponseSerializers(serverContext);
                    protocolGenerator.generateFrameworkErrorSerializer(serverContext);
                    delegator.useShapeWriter(shape, w -> {
                        protocolGenerator.generateServiceHandlerFactory(serverContext.withWriter(w));
                    });
                    for (OperationShape operation : TopDownIndex.of(model).getContainedOperations(service)) {
                        delegator.useShapeWriter(operation, w -> {
                            protocolGenerator.generateOperationHandlerFactory(serverContext.withWriter(w), operation);
                        });
                    }
                }
                protocolGenerator.generateSharedComponents(context);
            });
        }

        if (settings.generateServerSdk()) {
            for (OperationShape operation: directive.operations()) {
                delegator.useShapeWriter(operation, w -> {
                    ServerGenerator.generateOperationHandler(symbolProvider, service, operation, w);
                });
            }
        }
    }

    private void generateClient(GenerateServiceDirective<TypeScriptCodegenContext, TypeScriptSettings> directive) {
        TypeScriptDelegator delegator = directive.context().writerDelegator();
        TypeScriptSettings settings = directive.settings();
        ServiceShape service = directive.shape();
        Model model = directive.model();
        SymbolProvider symbolProvider = directive.symbolProvider();
        FileManifest fileManifest = directive.fileManifest();
        List<TypeScriptIntegration> integrations = directive.context().integrations();
        List<RuntimeClientPlugin> runtimePlugins = directive.context().runtimePlugins();
        ApplicationProtocol applicationProtocol = directive.context().applicationProtocol();

        // Generate the bare-bones service client.
        delegator.useShapeWriter(service, writer -> new ServiceBareBonesClientGenerator(
                settings, model, symbolProvider, writer, integrations, runtimePlugins, applicationProtocol).run());

        // Generate the aggregated service client.
        Symbol serviceSymbol = symbolProvider.toSymbol(service);
        String aggregatedClientName = serviceSymbol.getName().replace("Client", "");
        String filename = serviceSymbol.getDefinitionFile().replace("Client", "");
        delegator.useFileWriter(filename, writer -> new ServiceAggregatedClientGenerator(
                settings, model, symbolProvider, aggregatedClientName, writer, applicationProtocol).run());

        // Generate each operation for the service.
        Set<OperationShape> containedOperations = directive.operations();
        for (OperationShape operation : containedOperations) {
            if (operation.hasTrait(PaginatedTrait.ID)) {
                String outputFilename = PaginationGenerator.getOutputFilelocation(operation);
                delegator.useFileWriter(outputFilename, paginationWriter ->
                        new PaginationGenerator(model, service, operation, symbolProvider, paginationWriter,
                                aggregatedClientName).run());
            }
            if (operation.hasTrait(WaitableTrait.ID)) {
                WaitableTrait waitableTrait = operation.expectTrait(WaitableTrait.class);
                waitableTrait.getWaiters().forEach((String waiterName, Waiter waiter) -> {
                    String outputFilename = WaiterGenerator.getOutputFileLocation(waiterName);
                    delegator.useFileWriter(outputFilename, waiterWriter ->
                            new WaiterGenerator(waiterName, waiter, service, operation, waiterWriter,
                                    symbolProvider).run());
                });
            }
        }

        if (containedOperations.stream().anyMatch(operation -> operation.hasTrait(PaginatedTrait.ID))) {
            PaginationGenerator.writeIndex(model, service, fileManifest);
            delegator.useFileWriter(PaginationGenerator.PAGINATION_INTERFACE_FILE, paginationWriter ->
                    PaginationGenerator.generateServicePaginationInterfaces(
                            aggregatedClientName,
                            serviceSymbol,
                            paginationWriter));
        }

        if (containedOperations.stream().anyMatch(operation -> operation.hasTrait(WaitableTrait.ID))) {
            WaiterGenerator.writeIndex(model, service, fileManifest);
        }
    }

    private void generateCommands(GenerateServiceDirective<TypeScriptCodegenContext, TypeScriptSettings> directive) {
        TypeScriptDelegator delegator = directive.context().writerDelegator();
        TypeScriptSettings settings = directive.settings();
        ServiceShape service = directive.shape();
        Model model = directive.model();
        SymbolProvider symbolProvider = directive.symbolProvider();
        FileManifest fileManifest = directive.fileManifest();
        List<RuntimeClientPlugin> runtimePlugins = directive.context().runtimePlugins();
        ProtocolGenerator protocolGenerator = directive.context().protocolGenerator();
        ApplicationProtocol applicationProtocol = directive.context().applicationProtocol();

        // Generate each operation for the service.
        for (OperationShape operation :  directive.operations()) {
            // Right now this only generates stubs
            if (settings.generateClient()) {
                CommandGenerator.writeIndex(model, service, symbolProvider, fileManifest);
                delegator.useShapeWriter(operation, commandWriter -> new CommandGenerator(
                        settings, model, operation, symbolProvider, commandWriter,
                        runtimePlugins, protocolGenerator, applicationProtocol).run());
            }

            if (settings.generateServerSdk()) {
                ServerCommandGenerator.writeIndex(model, service, symbolProvider, fileManifest);
                delegator.useShapeWriter(operation, commandWriter -> new ServerCommandGenerator(
                        settings, model, operation, symbolProvider, commandWriter,
                        protocolGenerator, applicationProtocol).run());
            }
        }
    }

    private void generateServiceInterface(GenerateServiceDirective<TypeScriptCodegenContext, TypeScriptSettings> directive) {
        ServiceShape service = directive.shape();
        SymbolProvider symbolProvider = directive.symbolProvider();
        Set<OperationShape> operations = directive.operations();

        directive.context().writerDelegator().useShapeWriter(service, writer -> {
            ServerGenerator.generateOperationsType(symbolProvider, service, operations, writer);
            ServerGenerator.generateServerInterfaces(symbolProvider, service, operations, writer);
            ServerGenerator.generateServiceHandler(symbolProvider, service, operations, writer);
        });
    }

    @Override
    public void generateStructure(GenerateStructureDirective<TypeScriptCodegenContext, TypeScriptSettings> directive) {
        directive.context().writerDelegator().useShapeWriter(directive.shape(), writer -> {
            StructureGenerator generator = new StructureGenerator(
                    directive.model(),
                    directive.symbolProvider(),
                    writer,
                    directive.shape(),
                    directive.settings().generateServerSdk()
            );
            generator.run();
        });
    }

    @Override
    public void generateError(GenerateErrorDirective<TypeScriptCodegenContext, TypeScriptSettings> directive) {
        directive.context().writerDelegator().useShapeWriter(directive.shape(), writer -> {
            StructureGenerator generator = new StructureGenerator(
                    directive.model(),
                    directive.symbolProvider(),
                    writer,
                    directive.shape(),
                    directive.settings().generateServerSdk()
            );
            generator.run();
        });
    }

    @Override
    public void generateUnion(GenerateUnionDirective<TypeScriptCodegenContext, TypeScriptSettings> directive) {
        directive.context().writerDelegator().useShapeWriter(directive.shape(), writer -> {
            UnionGenerator generator = new UnionGenerator(
                    directive.model(),
                    directive.symbolProvider(),
                    writer,
                    directive.shape(),
                    directive.settings().generateServerSdk()
            );
            generator.run();
        });
    }

    @Override
    public void generateEnumShape(GenerateEnumDirective<TypeScriptCodegenContext, TypeScriptSettings> directive) {
        directive.context().writerDelegator().useShapeWriter(directive.shape(), writer -> {
            EnumGenerator generator = new EnumGenerator(
                    directive.shape().asStringShape().get(),
                    directive.symbolProvider().toSymbol(directive.shape()),
                    writer
            );
            generator.run();
        });
    }
}
