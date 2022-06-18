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
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.ServiceLoader;
import java.util.Set;
import java.util.TreeSet;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.TopologicalIndex;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.OperationIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.neighbor.Walker;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.ShapeVisitor;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.EnumTrait;
import software.amazon.smithy.model.traits.PaginatedTrait;
import software.amazon.smithy.model.validation.ValidationEvent;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings.ArtifactType;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.typescript.codegen.validation.LongValidator;
import software.amazon.smithy.utils.MapUtils;
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.waiters.WaitableTrait;
import software.amazon.smithy.waiters.Waiter;

@SmithyInternalApi
class CodegenVisitor extends ShapeVisitor.Default<Void> {

    private static final Logger LOGGER = Logger.getLogger(CodegenVisitor.class.getName());

    /**
     * A mapping of static resource files to copy over to a new filename.
     */
    private static final Map<String, String> STATIC_FILE_COPIES = MapUtils.of(
            "typedoc.json", "typedoc.json",
            "tsconfig.json", "tsconfig.json",
            "tsconfig.cjs.json", "tsconfig.cjs.json",
            "tsconfig.es.json", "tsconfig.es.json",
            "tsconfig.types.json", "tsconfig.types.json"
    );
    private static final ShapeId VALIDATION_EXCEPTION_SHAPE =
            ShapeId.fromParts("smithy.framework", "ValidationException");

    private final TypeScriptSettings settings;
    private final Model model;
    private final ServiceShape service;
    private final FileManifest fileManifest;
    private final SymbolProvider symbolProvider;
    private final TypeScriptDelegator writers;
    private final List<TypeScriptIntegration> integrations = new ArrayList<>();
    private final List<RuntimeClientPlugin> runtimePlugins = new ArrayList<>();
    private final ProtocolGenerator protocolGenerator;
    private final ApplicationProtocol applicationProtocol;

    CodegenVisitor(PluginContext context, ArtifactType artifactType) {
        // Load all integrations.
        ClassLoader loader = context.getPluginClassLoader().orElse(getClass().getClassLoader());
        LOGGER.info("Attempting to discover TypeScriptIntegration from the classpath...");
        ServiceLoader.load(TypeScriptIntegration.class, loader)
                .forEach(integration -> {
                    LOGGER.info(() -> "Adding TypeScriptIntegration: " + integration.getClass().getName());
                    integrations.add(integration);
                    integration.getClientPlugins().forEach(runtimePlugin -> {
                        LOGGER.info(() -> "Adding TypeScript runtime plugin: " + runtimePlugin);
                        runtimePlugins.add(runtimePlugin);
                    });
                });
        // Sort the integrations in specified order.
        integrations.sort(Comparator.comparingInt(TypeScriptIntegration::getOrder));

        // Preprocess model using integrations.
        settings = TypeScriptSettings.from(context.getModel(), context.getSettings(), artifactType);
        Model modifiedModel = context.getModel();
        for (TypeScriptIntegration integration : integrations) {
            modifiedModel = integration.preprocessModel(modifiedModel, settings);
        }
        model = modifiedModel;

        service = settings.getService(model);

        if (settings.getArtifactType().equals(ArtifactType.SSDK))  {
            LongValidator validator = new LongValidator(settings);
            List<ValidationEvent> events = validator.validate(model);
            System.err.println("Model contained SSDK-specific validation events: \n"
                    + events.stream().map(ValidationEvent::toString).sorted().collect(Collectors.joining("\n")));
        }

        fileManifest = context.getFileManifest();
        LOGGER.info(() -> String.format("Generating TypeScript %s for service %s",
                settings.generateClient() ? "client" : "server", service.getId()));

        // Decorate the symbol provider using integrations.
        SymbolProvider resolvedProvider = artifactType.createSymbolProvider(model, settings);
        for (TypeScriptIntegration integration : integrations) {
            resolvedProvider = integration.decorateSymbolProvider(model, settings, resolvedProvider);
        }
        symbolProvider = SymbolProvider.cache(resolvedProvider);

        // Resolve the nullable protocol generator and application protocol.
        protocolGenerator = resolveProtocolGenerator(integrations, service, settings);
        applicationProtocol = protocolGenerator == null
                ? ApplicationProtocol.createDefaultHttpApplicationProtocol()
                : protocolGenerator.getApplicationProtocol();

        writers = new TypeScriptDelegator(settings, model, fileManifest, symbolProvider, integrations);
    }

    private ProtocolGenerator resolveProtocolGenerator(
            Collection<TypeScriptIntegration> integrations,
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

    void execute() {
        // Write shared / static content.
        STATIC_FILE_COPIES.forEach((from, to) -> {
            LOGGER.fine(() -> "Writing contents of `" + from + "` to `" + to + "`");
            fileManifest.writeFile(from, getClass(), to);
        });

        // Generate models that are connected to the service being generated.
        LOGGER.fine("Walking shapes from " + service.getId() + " to find shapes to generate");
        Collection<Shape> shapes = new Walker(model).walkShapes(service);
        for (Shape shape : TopologicalIndex.of(model).getOrderedShapes()) {
            if (shapes.contains(shape)) {
                shape.accept(this);
            }
        }
        for (Shape shape : TopologicalIndex.of(model).getRecursiveShapes()) {
            if (shapes.contains(shape)) {
                shape.accept(this);
            }
        }
        SymbolVisitor.writeModelIndex(shapes, symbolProvider, fileManifest);

        // Generate the client Node and Browser configuration files. These
        // files are switched between in package.json based on the targeted
        // environment.
        if (settings.generateClient()) {
            // For now these are only generated for clients.
            // TODO: generate ssdk config
            RuntimeConfigGenerator configGenerator = new RuntimeConfigGenerator(
                    settings, model, symbolProvider, writers, integrations);
            for (LanguageTarget target : LanguageTarget.values()) {
                LOGGER.fine("Generating " + target + " runtime configuration");
                configGenerator.generate(target);
            }
        }

        // Write each custom file.
        for (TypeScriptIntegration integration : integrations) {
            LOGGER.finer(() -> "Calling writeAdditionalFiles on " + integration.getClass().getCanonicalName());
            integration.writeAdditionalFiles(settings, model, symbolProvider, writers::useFileWriter);
        }

        // Generate index for client.
        IndexGenerator.writeIndex(settings, model, symbolProvider, fileManifest, integrations, protocolGenerator);

        if (settings.generateServerSdk()) {
            checkValidationSettings();
            // Generate index for server
            IndexGenerator.writeServerIndex(settings, model, symbolProvider, fileManifest);
        }

        // Generate protocol tests IFF found in the model.
        if (protocolGenerator != null) {
            ShapeId protocol = protocolGenerator.getProtocol();
            ProtocolGenerator.GenerationContext context = new ProtocolGenerator.GenerationContext();
            context.setProtocolName(protocolGenerator.getName());
            context.setModel(model);
            context.setService(service);
            context.setSettings(settings);
            context.setSymbolProvider(symbolProvider);
            String baseName = protocol.getName().toLowerCase(Locale.US)
                    .replace("-", "_")
                    .replace(".", "_");
            String protocolTestFileName = String.format("test/functional/%s.spec.ts", baseName);
            context.setDeferredWriter(() -> writers.checkoutFileWriter(protocolTestFileName));
            protocolGenerator.generateProtocolTests(context);
        }

        // Write each pending writer.
        LOGGER.fine("Flushing TypeScript writers");
        List<SymbolDependency> dependencies = writers.getDependencies();
        writers.flushWriters();

        // Write the package.json file, including all symbol dependencies.
        LOGGER.fine("Generating package.json files");
        PackageJsonGenerator.writePackageJson(
                settings, fileManifest, SymbolDependency.gatherDependencies(dependencies.stream()));
    }

    private void checkValidationSettings() {
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
                    + "to 'true' in the plugin settings. Operations without %s errors attached: %s",
                    VALIDATION_EXCEPTION_SHAPE,
                    TypeScriptSettings.DISABLE_DEFAULT_VALIDATION,
                    VALIDATION_EXCEPTION_SHAPE,
                    unvalidatedOperations));
        }
    }

    @Override
    protected Void getDefault(Shape shape) {
        return null;
    }

    @Override
    public Void structureShape(StructureShape shape) {
        writers.useShapeWriter(shape, writer ->
                new StructureGenerator(model, symbolProvider, writer, shape, settings.generateServerSdk()).run());
        return null;
    }

    @Override
    public Void unionShape(UnionShape shape) {
        writers.useShapeWriter(shape, writer ->
                new UnionGenerator(model, symbolProvider, writer, shape, settings.generateServerSdk()).run());
        return null;
    }

    @Override
    public Void stringShape(StringShape shape) {
        if (shape.hasTrait(EnumTrait.class)) {
            Symbol symbol = symbolProvider.toSymbol(shape);
            writers.useShapeWriter(shape, writer -> new EnumGenerator(shape, symbol, writer).run());
        }

        return null;
    }

    @Override
    public Void operationShape(OperationShape operation) {
        if (settings.generateServerSdk()) {
            writers.useShapeWriter(operation, w -> {
                ServerGenerator.generateOperationHandler(symbolProvider, service, operation, w);
            });
        }
        return null;
    }

    @Override
    public Void serviceShape(ServiceShape shape) {
        if (!Objects.equals(service, shape)) {
            LOGGER.fine(() -> "Skipping `" + shape.getId() + "` because it is not `" + service.getId() + "`");
            return null;
        }

        if (settings.generateClient()) {
            generateClient(shape);
        }
        if (settings.generateClient() || settings.generateServerSdk()) {
            generateCommands(shape);
        }

        if (settings.generateServerSdk()) {
            generateServiceInterface(shape);
        }

        if (protocolGenerator != null) {
            LOGGER.info("Generating serde for protocol " + protocolGenerator.getName() + " on " + shape.getId());
            String fileName = Paths.get(CodegenUtils.SOURCE_FOLDER, ProtocolGenerator.PROTOCOLS_FOLDER,
                ProtocolGenerator.getSanitizedName(protocolGenerator.getName()) + ".ts").toString();
            writers.useFileWriter(fileName, writer -> {
                ProtocolGenerator.GenerationContext context = new ProtocolGenerator.GenerationContext();
                context.setProtocolName(protocolGenerator.getName());
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
                    protocolGenerator.generateRequestDeserializers(context);
                    protocolGenerator.generateResponseSerializers(context);
                    protocolGenerator.generateFrameworkErrorSerializer(context);
                    writers.useShapeWriter(shape, w -> {
                        protocolGenerator.generateServiceHandlerFactory(context.withWriter(w));
                    });
                    for (OperationShape operation: TopDownIndex.of(model).getContainedOperations(service)) {
                        writers.useShapeWriter(operation, w -> {
                            protocolGenerator.generateOperationHandlerFactory(context.withWriter(w), operation);
                        });
                    }
                }
                protocolGenerator.generateSharedComponents(context);
            });
        }

        return null;
    }

    private void generateClient(ServiceShape shape) {
        // Generate the bare-bones service client.
        writers.useShapeWriter(shape, writer -> new ServiceBareBonesClientGenerator(
                settings, model, symbolProvider, writer, integrations, runtimePlugins, applicationProtocol).run());

        // Generate the aggregated service client.
        Symbol serviceSymbol = symbolProvider.toSymbol(shape);
        String aggregatedClientName = serviceSymbol.getName().replace("Client", "");
        String filename = serviceSymbol.getDefinitionFile().replace("Client", "");
        writers.useFileWriter(filename, writer -> new ServiceAggregatedClientGenerator(
                settings, model, symbolProvider, aggregatedClientName, writer, applicationProtocol).run());

        // Generate each operation for the service.
        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> containedOperations = new TreeSet<>(topDownIndex.getContainedOperations(service));

        for (OperationShape operation : containedOperations) {
            if (operation.hasTrait(PaginatedTrait.ID)) {
                String outputFilename = PaginationGenerator.getOutputFilelocation(operation);
                writers.useFileWriter(outputFilename, paginationWriter ->
                        new PaginationGenerator(model, service, operation, symbolProvider, paginationWriter,
                                aggregatedClientName).run());
            }
            if (operation.hasTrait(WaitableTrait.ID)) {
                WaitableTrait waitableTrait = operation.expectTrait(WaitableTrait.class);
                waitableTrait.getWaiters().forEach((String waiterName, Waiter waiter) -> {
                    String outputFilename = WaiterGenerator.getOutputFileLocation(waiterName);
                    writers.useFileWriter(outputFilename, waiterWriter ->
                            new WaiterGenerator(waiterName, waiter, service, operation, waiterWriter,
                                    symbolProvider).run());
                });
            }
        }

        if (containedOperations.stream().anyMatch(operation -> operation.hasTrait(PaginatedTrait.ID))) {
            PaginationGenerator.writeIndex(model, service, fileManifest);
            writers.useFileWriter(PaginationGenerator.PAGINATION_INTERFACE_FILE, paginationWriter ->
                    PaginationGenerator.generateServicePaginationInterfaces(
                            aggregatedClientName,
                            serviceSymbol,
                            paginationWriter));
        }

        if (containedOperations.stream().anyMatch(operation -> operation.hasTrait(WaitableTrait.ID))) {
            WaiterGenerator.writeIndex(model, service, fileManifest);
        }
    }

    private void generateServiceInterface(ServiceShape shape) {
        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> operations = new TreeSet<>(topDownIndex.getContainedOperations(shape));
        writers.useShapeWriter(shape, writer -> {
            ServerGenerator.generateOperationsType(symbolProvider, shape, operations, writer);
            ServerGenerator.generateServerInterfaces(symbolProvider, shape, operations, writer);
            ServerGenerator.generateServiceHandler(symbolProvider, shape, operations, writer);
        });
    }

    private void generateCommands(ServiceShape shape) {
        // Generate each operation for the service.
        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> containedOperations = new TreeSet<>(topDownIndex.getContainedOperations(shape));
        for (OperationShape operation : containedOperations) {
            // Right now this only generates stubs
            if (settings.generateClient()) {
                CommandGenerator.writeIndex(model, service, symbolProvider, fileManifest);
                writers.useShapeWriter(operation, commandWriter -> new CommandGenerator(
                        settings, model, operation, symbolProvider, commandWriter,
                        runtimePlugins, protocolGenerator, applicationProtocol).run());
            }

            if (settings.generateServerSdk()) {
                ServerCommandGenerator.writeIndex(model, service, symbolProvider, fileManifest);
                writers.useShapeWriter(operation, commandWriter -> new ServerCommandGenerator(
                        settings, model, operation, symbolProvider, commandWriter,
                        protocolGenerator, applicationProtocol).run());
            }
        }
    }
}
