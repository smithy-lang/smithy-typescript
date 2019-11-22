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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.ServiceLoader;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Function;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.neighbor.Walker;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeIndex;
import software.amazon.smithy.model.shapes.ShapeVisitor;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.EnumTrait;
import software.amazon.smithy.model.traits.ProtocolsTrait;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.utils.MapUtils;

class CodegenVisitor extends ShapeVisitor.Default<Void> {

    private static final Logger LOGGER = Logger.getLogger(CodegenVisitor.class.getName());

    /** A mapping of static resource files to copy over to a new filename. */
    private static final Map<String, String> STATIC_FILE_COPIES = MapUtils.of(
            "lib/smithy.ts", "smithy.ts",
            "tsconfig.es.json", "tsconfig.es.json",
            "tsconfig.json", "tsconfig.json",
            "tsconfig.test.json", "tsconfig.test.json"
    );

    private final TypeScriptSettings settings;
    private final Model model;
    private final ServiceShape service;
    private final FileManifest fileManifest;
    private final SymbolProvider symbolProvider;
    private final ShapeIndex nonTraits;
    private final TypeScriptDelegator writers;
    private final List<TypeScriptIntegration> integrations = new ArrayList<>();
    private final List<RuntimeClientPlugin> runtimePlugins = new ArrayList<>();
    private final ApplicationProtocol applicationProtocol;

    CodegenVisitor(PluginContext context) {
        settings = TypeScriptSettings.from(context.getModel(), context.getSettings());
        nonTraits = context.getNonTraitShapes();
        model = context.getModel();
        service = settings.getService(model);
        fileManifest = context.getFileManifest();
        LOGGER.info(() -> "Generating TypeScript client for service " + service.getId());

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

        // Decorate the symbol provider using integrations.
        SymbolProvider resolvedProvider = TypeScriptCodegenPlugin.createSymbolProvider(model);
        for (TypeScriptIntegration integration : integrations) {
            resolvedProvider = integration.decorateSymbolProvider(settings, model, resolvedProvider);
        }
        symbolProvider = SymbolProvider.cache(resolvedProvider);

        writers = new TypeScriptDelegator(settings, model, fileManifest, symbolProvider, integrations);
        applicationProtocol = ApplicationProtocol.resolve(settings, service, integrations);
    }

    void execute() {
        // Write shared / static content.
        STATIC_FILE_COPIES.forEach((from, to) -> {
            LOGGER.fine(() -> "Writing contents of `" + from + "` to `" + to + "`");
            fileManifest.writeFile(from, getClass(), to);
        });

        // Generate models that are connected to the service being generated.
        LOGGER.fine("Walking shapes from " + service.getId() + " to find shapes to generate");
        Set<Shape> serviceShapes = new TreeSet<>(new Walker(nonTraits).walkShapes(service));
        serviceShapes.forEach(shape -> shape.accept(this));

        // Generate the client Node and Browser configuration files. These
        // files are switched between in package.json based on the targeted
        // environment.
        String defaultProtocolName = getDefaultGenerator().map(ProtocolGenerator::getName).orElse(null);
        LOGGER.fine("Resolved the default protocol of the client to " + defaultProtocolName);

        // Generate each runtime config file for targeted platforms.
        RuntimeConfigGenerator configGenerator = new RuntimeConfigGenerator(
                settings, model, symbolProvider, defaultProtocolName, writers, integrations);
        for (LanguageTarget target : LanguageTarget.values()) {
            LOGGER.fine("Generating " + target + " runtime configuration");
            configGenerator.generate(target);
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

    // Finds the first listed protocol from the service that has a
    // discovered protocol generator that matches the name.
    private Optional<ProtocolGenerator> getDefaultGenerator() {
        List<String> protocols = settings.resolveServiceProtocols(service);
        Map<String, ProtocolGenerator> generators = integrations.stream()
                .flatMap(integration -> integration.getProtocolGenerators().stream())
                .collect(Collectors.toMap(ProtocolGenerator::getName, Function.identity()));
        return protocols.stream()
                .filter(generators::containsKey)
                .map(generators::get)
                .findFirst();
    }

    @Override
    protected Void getDefault(Shape shape) {
        return null;
    }

    /**
     * Renders structures as interfaces.
     *
     * <p>A namespace is created with the same name as the structure to
     * provide helper functionality for checking if a given value is
     * known to be of the same type as the structure. This will be
     * even more useful if/when inheritance is added to Smithy.
     *
     * <p>Note that the {@code required} trait on structures is used to
     * determine whether or not a generated TypeScript interface uses
     * required members. This is typically not recommended in other languages
     * since it's documented as backward-compatible for a model to migrate a
     * required property to optional. This becomes an issue when an older
     * client consumes a service that has relaxed a member to become optional.
     * In the case of sending data from the client to the server, the client
     * likely either is still operating under the assumption that the property
     * is required, or the client can set a property explicitly to
     * {@code undefined} to fix any TypeScript compilation errors. In the
     * case of deserializing a value from a service to the client, the
     * deserializers will need to set previously required properties to
     * undefined too.
     *
     * <p>The generator will explicitly state that a required property can
     * be set to {@code undefined}. This makes it clear that undefined checks
     * need to be made when using {@code --strictNullChecks}, but has no
     * effect otherwise.
     *
     * @param shape Shape being generated.
     */
    @Override
    public Void structureShape(StructureShape shape) {
        writers.useShapeWriter(shape, writer -> new StructureGenerator(model, symbolProvider, writer, shape).run());
        return null;
    }

    /**
     * Renders a TypeScript union.
     *
     * @param shape Shape to render as a union.
     * @see UnionGenerator
     */
    @Override
    public Void unionShape(UnionShape shape) {
        writers.useShapeWriter(shape, writer -> new UnionGenerator(model, symbolProvider, writer, shape).run());
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
    public Void serviceShape(ServiceShape shape) {
        if (!Objects.equals(service, shape)) {
            LOGGER.fine(() -> "Skipping `" + service.getId() + "` because it is not `" + service.getId() + "`");
            return null;
        }

        // Generate the modular service client.
        writers.useShapeWriter(shape, writer -> new ServiceGenerator(
                settings, model, symbolProvider, writer, integrations, runtimePlugins, applicationProtocol).run());

        // Generate the non-modular service client.
        Symbol serviceSymbol = symbolProvider.toSymbol(shape);
        String nonModularName = serviceSymbol.getName().replace("Client", "");
        String filename = serviceSymbol.getDefinitionFile().replace("Client", "");
        writers.useFileWriter(filename, writer -> new NonModularServiceGenerator(
                settings, model, symbolProvider, nonModularName, writer).run());

        // Generate each operation for the service.
        TopDownIndex topDownIndex = model.getKnowledge(TopDownIndex.class);
        for (OperationShape operation : topDownIndex.getContainedOperations(service)) {
            writers.useShapeWriter(operation, commandWriter -> new CommandGenerator(
                    settings, model, operation, symbolProvider, commandWriter,
                    runtimePlugins, applicationProtocol).run());
        }

        // Generate each protocol.
        shape.getTrait(ProtocolsTrait.class).ifPresent(protocolsTrait -> {
            LOGGER.info("Looking for protocol generators for protocols: " + protocolsTrait.getProtocolNames());
            for (TypeScriptIntegration integration : integrations) {
                for (ProtocolGenerator generator : integration.getProtocolGenerators()) {
                    if (protocolsTrait.hasProtocol(generator.getName())) {
                        LOGGER.info("Generating serde for protocol " + generator.getName() + " on " + shape.getId());
                        String fileRoot = "protocols/" + ProtocolGenerator.getSanitizedName(generator.getName());
                        String namespace = "./" + fileRoot;
                        TypeScriptWriter writer = new TypeScriptWriter(namespace);
                        ProtocolGenerator.GenerationContext context = new ProtocolGenerator.GenerationContext();
                        context.setProtocolName(generator.getName());
                        context.setIntegrations(integrations);
                        context.setModel(model);
                        context.setService(shape);
                        context.setSettings(settings);
                        context.setSymbolProvider(symbolProvider);
                        context.setWriter(writer);
                        generator.generateRequestSerializers(context);
                        generator.generateResponseDeserializers(context);
                        generator.generateSharedComponents(context);
                        fileManifest.writeFile(fileRoot + ".ts", writer.toString());
                    }
                }
            }
        });

        return null;
    }
}
