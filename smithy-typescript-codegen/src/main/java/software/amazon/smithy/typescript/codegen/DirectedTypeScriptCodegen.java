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
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.directed.CreateContextDirective;
import software.amazon.smithy.codegen.core.directed.CreateSymbolProviderDirective;
import software.amazon.smithy.codegen.core.directed.CustomizeDirective;
import software.amazon.smithy.codegen.core.directed.DirectedCodegen;
import software.amazon.smithy.codegen.core.directed.GenerateEnumDirective;
import software.amazon.smithy.codegen.core.directed.GenerateErrorDirective;
import software.amazon.smithy.codegen.core.directed.GenerateIntEnumDirective;
import software.amazon.smithy.codegen.core.directed.GenerateServiceDirective;
import software.amazon.smithy.codegen.core.directed.GenerateStructureDirective;
import software.amazon.smithy.codegen.core.directed.GenerateUnionDirective;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.OperationIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.traits.PaginatedTrait;
import software.amazon.smithy.model.validation.ValidationEvent;
import software.amazon.smithy.rulesengine.traits.EndpointRuleSetTrait;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthSchemeProviderGenerator;
import software.amazon.smithy.typescript.codegen.endpointsV2.EndpointsV2Generator;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.typescript.codegen.validation.LongValidator;
import software.amazon.smithy.typescript.codegen.validation.ReplaceLast;
import software.amazon.smithy.utils.MapUtils;
import software.amazon.smithy.utils.SmithyUnstableApi;
import software.amazon.smithy.waiters.WaitableTrait;
import software.amazon.smithy.waiters.Waiter;

@SmithyUnstableApi
final class DirectedTypeScriptCodegen
        implements DirectedCodegen<TypeScriptCodegenContext, TypeScriptSettings, TypeScriptIntegration> {

    private static final Logger LOGGER = Logger.getLogger(DirectedTypeScriptCodegen.class.getName());

    /**
     * A mapping of static resource files to copy over to a new filename.
     */
    private static final Map<String, String> STATIC_FILE_COPIES = MapUtils.of(
            "tsconfig.json", "tsconfig.json",
            "tsconfig.cjs.json", "tsconfig.cjs.json",
            "tsconfig.es.json", "tsconfig.es.json",
            "tsconfig.types.json", "tsconfig.types.json"
    );
    private static final ShapeId VALIDATION_EXCEPTION_SHAPE =
            ShapeId.fromParts("smithy.framework", "ValidationException");

    @Override
    public SymbolProvider createSymbolProvider(CreateSymbolProviderDirective<TypeScriptSettings> directive) {
        return directive.settings().getArtifactType().createSymbolProvider(directive.model(), directive.settings());
    }

    @Override
    public TypeScriptCodegenContext createContext(CreateContextDirective<TypeScriptSettings,
            TypeScriptIntegration> directive) {

        List<RuntimeClientPlugin> runtimePlugins = new ArrayList<>();
        directive.integrations().forEach(integration -> {
            LOGGER.info(() -> "Adding TypeScriptIntegration: " + integration.getClass().getName());
            integration.getClientPlugins().forEach(runtimePlugin -> {
                if (runtimePlugin.matchesSettings(directive.model(), directive.service(), directive.settings())) {
                    LOGGER.info(() -> "Adding TypeScript runtime plugin: " + runtimePlugin);
                    runtimePlugins.add(runtimePlugin);
                } else {
                    LOGGER.info(() -> "Skipping TypeScript runtime plugin based on settings: " + runtimePlugin);
                }
            });
        });

        directive.integrations().forEach(integration -> {
            LOGGER.info(() -> "Mutating plugins from TypeScriptIntegration: " + integration.name());
            integration.mutateClientPlugins(runtimePlugins);
        });

        ProtocolGenerator protocolGenerator = resolveProtocolGenerator(
                directive.integrations(),
                directive.model(),
                directive.service(),
                directive.settings());
        ApplicationProtocol applicationProtocol = protocolGenerator == null
                ? ApplicationProtocol.createDefaultHttpApplicationProtocol()
                : protocolGenerator.getApplicationProtocol();

        return TypeScriptCodegenContext.builder()
                .model(directive.model())
                .settings(directive.settings())
                .symbolProvider(directive.symbolProvider())
                .fileManifest(directive.fileManifest())
                .integrations(directive.integrations())
                .runtimePlugins(runtimePlugins)
                .protocolGenerator(protocolGenerator)
                .applicationProtocol(applicationProtocol)
                .writerDelegator(new TypeScriptDelegator(directive.fileManifest(), directive.symbolProvider()))
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
        Model model = directive.model();
        ServiceShape service = directive.shape();
        TypeScriptDelegator delegator = directive.context().writerDelegator();

        if (settings.generateServerSdk())  {
            checkValidationSettings(settings, model, service);

            LongValidator validator = new LongValidator(settings);
            List<ValidationEvent> events = validator.validate(model);
            System.err.println("Model contained SSDK-specific validation events: \n"
                    + events.stream().map(ValidationEvent::toString).sorted().collect(Collectors.joining("\n")));
        }

        if (settings.generateClient()) {
            generateClient(directive);
        }
        if (settings.generateClient() || settings.generateServerSdk()) {
            generateCommands(directive);
            generateEndpointV2(directive);
        }

        if (settings.generateServerSdk()) {
            generateServiceInterface(directive);
        }

        ProtocolGenerator protocolGenerator = directive.context().protocolGenerator();
        SymbolProvider symbolProvider = directive.symbolProvider();
        if (protocolGenerator != null) {
            LOGGER.info("Generating serde for protocol " + protocolGenerator.getName() + " on " + service.getId());
            String fileName = Paths.get(CodegenUtils.SOURCE_FOLDER, ProtocolGenerator.PROTOCOLS_FOLDER,
                    ProtocolGenerator.getSanitizedName(protocolGenerator.getName()) + ".ts").toString();
            delegator.useFileWriter(fileName, writer -> {
                ProtocolGenerator.GenerationContext context = new ProtocolGenerator.GenerationContext();
                context.setProtocolName(protocolGenerator.getName());
                context.setModel(model);
                context.setService(service);
                context.setSettings(settings);
                context.setSymbolProvider(symbolProvider);
                context.setWriter(writer);
                if (context.getSettings().generateClient()) {
                    protocolGenerator.generateRequestSerializers(context);
                    protocolGenerator.generateResponseDeserializers(context);
                }
                if (context.getSettings().generateServerSdk()) {
                    protocolGenerator.generateRequestDeserializers(context);
                    protocolGenerator.generateResponseSerializers(context);
                    protocolGenerator.generateFrameworkErrorSerializer(context);
                    delegator.useShapeWriter(service, w -> {
                        protocolGenerator.generateServiceHandlerFactory(context.withWriter(w));
                    });
                    for (OperationShape operation : TopDownIndex.of(model).getContainedOperations(service)) {
                        delegator.useShapeWriter(operation, w -> {
                            protocolGenerator.generateOperationHandlerFactory(context.withWriter(w), operation);
                        });
                    }
                }
                protocolGenerator.generateSharedComponents(context);
            });
        }

        if (settings.generateServerSdk()) {
            for (OperationShape operation : directive.operations()) {
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

        if (!directive.settings().useLegacyAuth()) {
            new HttpAuthSchemeProviderGenerator(
                delegator,
                settings,
                model,
                symbolProvider,
                directive.context().integrations()
            ).run();
        }

        // Generate the aggregated service client.
        Symbol serviceSymbol = symbolProvider.toSymbol(service);
        String aggregatedClientName = ReplaceLast.in(serviceSymbol.getName(), "Client", "");
        String filename = ReplaceLast.in(serviceSymbol.getDefinitionFile(), "Client", "");
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

        // Write operation index files
        if (settings.generateClient()) {
            CommandGenerator.writeIndex(model, service, symbolProvider, fileManifest);
        }
        if (settings.generateServerSdk()) {
            ServerCommandGenerator.writeIndex(model, service, symbolProvider, fileManifest);
        }

        // Generate each operation for the service.
        for (OperationShape operation : directive.operations()) {
            // Right now this only generates stubs
            if (settings.generateClient()) {
                delegator.useShapeWriter(operation, commandWriter -> new CommandGenerator(
                        settings, model, operation, symbolProvider, commandWriter,
                        runtimePlugins, protocolGenerator, applicationProtocol).run());
            }

            if (settings.generateServerSdk()) {
                delegator.useShapeWriter(operation, commandWriter -> new ServerCommandGenerator(
                        settings, model, operation, symbolProvider, commandWriter,
                        protocolGenerator, applicationProtocol).run());
            }
        }
    }

    private void generateEndpointV2(GenerateServiceDirective<TypeScriptCodegenContext, TypeScriptSettings> directive) {
        if (!directive.shape().hasTrait(EndpointRuleSetTrait.class)) {
            return;
        }

        new EndpointsV2Generator(directive.context().writerDelegator(), directive.settings(), directive.model()).run();
    }

    private void generateServiceInterface(GenerateServiceDirective<TypeScriptCodegenContext,
            TypeScriptSettings> directive) {
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
                    directive.settings().generateServerSdk(),
                    directive.settings().getRequiredMemberMode()
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
                    directive.settings().generateServerSdk(),
                    directive.settings().getRequiredMemberMode()
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

    @Override
    public void generateIntEnumShape(GenerateIntEnumDirective<TypeScriptCodegenContext, TypeScriptSettings> directive) {
        directive.context().writerDelegator().useShapeWriter(directive.shape(), writer -> {
            IntEnumGenerator generator = new IntEnumGenerator(
                    directive.shape().asIntEnumShape().get(),
                    directive.symbolProvider().toSymbol(directive.shape()),
                    writer
            );
            generator.run();
        });
    }

    @Override
    public void customizeBeforeIntegrations(
            CustomizeDirective<TypeScriptCodegenContext, TypeScriptSettings> directive) {
        // Write shared / static content.
        STATIC_FILE_COPIES.forEach((from, to) -> {
            LOGGER.fine(() -> "Writing contents of `" + from + "` to `" + to + "`");
            directive.fileManifest().writeFile(from, getClass(), to);
        });

        SymbolVisitor.writeModelIndex(directive.connectedShapes().values(), directive.symbolProvider(),
                directive.fileManifest());

        // Generate the client Node and Browser configuration files. These
        // files are switched between in package.json based on the targeted
        // environment.
        if (directive.settings().generateClient()) {
            // For now these are only generated for clients.
            // TODO: generate ssdk config
            RuntimeConfigGenerator configGenerator = new RuntimeConfigGenerator(
                    directive.settings(),
                    directive.model(),
                    directive.symbolProvider(),
                    directive.context().writerDelegator(),
                    directive.context().integrations(),
                    directive.context().applicationProtocol());
            for (LanguageTarget target : LanguageTarget.values()) {
                LOGGER.fine("Generating " + target + " runtime configuration");
                configGenerator.generate(target);
            }
            new ExtensionConfigurationGenerator(
                directive.model(),
                directive.settings(),
                directive.service(),
                directive.symbolProvider(),
                directive.context().writerDelegator(),
                directive.context().integrations()
            ).generate();
            new RuntimeExtensionsGenerator(
                directive.model(),
                directive.settings(),
                directive.service(),
                directive.symbolProvider(),
                directive.context().writerDelegator(),
                directive.context().integrations()
            ).generate();
        }

        // Generate index for client.
        BiConsumer<String, Consumer<TypeScriptWriter>> writerFactory =
            directive.context().writerDelegator()::useFileWriter;

        writerFactory.accept(Paths.get(CodegenUtils.SOURCE_FOLDER, "index.ts").toString(), writer -> {
            IndexGenerator.writeIndex(
                directive.settings(),
                directive.model(),
                directive.symbolProvider(),
                directive.context().protocolGenerator(),
                writer
            );
        });

        if (directive.settings().generateServerSdk()) {
            // Generate index for server
            IndexGenerator.writeServerIndex(
                    directive.settings(),
                    directive.model(),
                    directive.symbolProvider(),
                    directive.fileManifest());
        }

        // Generate protocol tests IFF found in the model.
        ProtocolGenerator protocolGenerator = directive.context().protocolGenerator();
        if (protocolGenerator != null) {
            ProtocolGenerator.GenerationContext context = new ProtocolGenerator.GenerationContext();
            context.setProtocolName(protocolGenerator.getName());
            context.setModel(directive.model());
            context.setService(directive.service());
            context.setSettings(directive.settings());
            context.setSymbolProvider(directive.symbolProvider());
            context.setWriterDelegator(directive.context().writerDelegator());
            protocolGenerator.generateProtocolTests(context);
        }

    }

    private void checkValidationSettings(TypeScriptSettings settings, Model model, ServiceShape service) {
        if (settings.isDisableDefaultValidation()) {
            return;
        }

        final OperationIndex operationIndex = OperationIndex.of(model);

        List<String> unvalidatedOperations = TopDownIndex.of(model)
                .getContainedOperations(service)
                .stream()
                .filter(o -> operationIndex.getErrors(o, service).stream()
                        .noneMatch(e -> e.getId().equals(VALIDATION_EXCEPTION_SHAPE)))
                .map(s -> s.getId().toString())
                .sorted()
                .collect(Collectors.toList());

        if (!unvalidatedOperations.isEmpty()) {
            throw new CodegenException(String.format("Every operation must have the %s error attached unless %s is set "
                                                     + "to 'true' in the plugin settings. Operations without %s "
                                                     + "errors attached: %s",
                    VALIDATION_EXCEPTION_SHAPE,
                    TypeScriptSettings.DISABLE_DEFAULT_VALIDATION,
                    VALIDATION_EXCEPTION_SHAPE,
                    unvalidatedOperations));
        }
    }

    @Override
    public void customizeAfterIntegrations(CustomizeDirective<TypeScriptCodegenContext, TypeScriptSettings> directive) {
        LOGGER.fine("Generating package.json files");
        PackageJsonGenerator.writePackageJson(
                directive.settings(),
                directive.fileManifest(),
                SymbolDependency.gatherDependencies(directive.context().writerDelegator().getDependencies().stream()));
    }
}
