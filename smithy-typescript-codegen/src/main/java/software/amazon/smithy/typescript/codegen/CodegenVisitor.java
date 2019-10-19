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
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.ServiceLoader;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Consumer;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.SymbolReference;
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
import software.amazon.smithy.model.traits.ErrorTrait;
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
    private final CodeWriterDelegator<TypeScriptWriter> writers;
    private final List<TypeScriptIntegration> integrations = new ArrayList<>();
    private final List<RuntimeClientPlugin> runtimePlugins = new ArrayList<>();
    private final ApplicationProtocol applicationProtocol;

    CodegenVisitor(PluginContext context) {
        settings = TypeScriptSettings.from(context.getSettings());
        nonTraits = context.getNonTraitShapes();
        model = context.getModel();
        service = settings.getService(model);
        fileManifest = context.getFileManifest();
        symbolProvider = SymbolProvider.cache(TypeScriptCodegenPlugin.createSymbolProvider(model));
        writers = TypeScriptWriter.createDelegator(model, symbolProvider, fileManifest);
        LOGGER.info(() -> "Generating TypeScript client for service " + service.getId());

        // Load all integrations.
        ClassLoader loader = context.getPluginClassLoader().orElse(getClass().getClassLoader());
        LOGGER.info("Attempting to discover TypeScriptIntegration from the classpath...");
        ServiceLoader.load(TypeScriptIntegration.class, loader)
                .forEach(integration -> {
                    LOGGER.info(() -> "Adding TypeScriptIntegration: " + integration.getClass().getName());
                    integrations.add(integration);
                    integration.getClientPlugins().forEach(runtimePlugin -> {
                        LOGGER.info(() -> "Adding TypeScript runtime plugin: " + runtimePlugin.getSymbol());
                        runtimePlugins.add(runtimePlugin);
                    });
                });

        applicationProtocol = ApplicationProtocol.resolve(settings, service, integrations);
    }

    void execute() {
        // Write shared / static content.
        STATIC_FILE_COPIES.forEach((from, to) -> fileManifest.writeFile(from, getClass(), to));

        // Generate models that are connected to the service being generated.
        Set<Shape> serviceShapes = new TreeSet<>(new Walker(nonTraits).walkShapes(service));
        serviceShapes.forEach(shape -> shape.accept(this));

        // Write each pending writer.
        Collection<TypeScriptWriter> usedWriters = writers.flush();

        // Write the package.json file, including all symbol dependencies.
        PackageJsonGenerator.writePackageJson(settings, fileManifest, SymbolDependency.gatherDependencies(
                usedWriters.stream().flatMap(writer -> writer.getDependencies().stream())));
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
        useWriter(shape, writer -> {
            if (shape.hasTrait(ErrorTrait.class)) {
                renderErrorStructure(shape, writer);
            } else {
                renderNonErrorStructure(shape, writer);
            }
        });
        return null;
    }

    /**
     * Renders a normal, non-error structure.
     *
     * <p>For example, given the following Smithy model:
     *
     * <pre>{@code
     * namespace smithy.example
     *
     * structure Person {
     *     @required
     *     name: String,
     *     age: Integer,
     * }
     * }</pre>
     *
     * <p>The following TypeScript is rendered:
     *
     * <pre>{@code
     * import * as _smithy from "../lib/smithy";
     *
     * export interface Person {
     *   __type?: "smithy.example#Person";
     *   name: string | undefined;
     *   age?: number | null;
     * }
     *
     * export namespace Person {
     *   export const ID = "smithy.example#Person";
     *   export function isa(o: any): o is Person {
     *     return _smithy.isa(o, ID);
     *   }
     * }
     * }</pre>
     *
     * @param shape Structure to render.
     * @param writer Writer to write to.
     */
    private void renderNonErrorStructure(StructureShape shape, TypeScriptWriter writer) {
        Symbol symbol = symbolProvider.toSymbol(shape);
        writer.writeShapeDocs(shape);

        // Find symbol references with the "extends" property.
        String extendsFrom = symbol.getReferences().stream()
                .filter(ref -> ref.getProperty("extends").isPresent())
                .map(SymbolReference::getAlias)
                .collect(Collectors.joining(", "));

        if (extendsFrom.isEmpty()) {
            writer.openBlock("export interface $L {", symbol.getName());
        } else {
            writer.openBlock("export interface $L extends $L {", symbol.getName(), extendsFrom);
        }

        writer.write("__type?: $S;", shape.getId());
        StructuredMemberWriter config = new StructuredMemberWriter(
                model, symbolProvider, shape.getAllMembers().values());
        config.writeMembers(writer, shape);
        writer.closeBlock("}");
        writer.write("");
        renderStructureNamespace(shape, writer);
    }

    /**
     * Error structures generate interfaces that extend from SmithyException
     * and add the appropriate fault property.
     *
     * <p>Given the following Smithy structure:
     *
     * <pre>{@code
     * namespace smithy.example
     *
     * @error("client")
     * structure NoSuchResource {
     *     @required
     *     resourceType: String
     * }
     * }</pre>
     *
     * <p>The following TypeScript is generated:
     *
     * <pre>{@code
     * import * as _smithy from "../lib/smithy";
     *
     * export interface NoSuchResource extends _smithy.SmithyException {
     *   __type: "smithy.example#NoSuchResource";
     *   $name: "NoSuchResource";
     *   $fault: "client";
     *   resourceType: string | undefined;
     * }
     *
     * export namespace Person {
     *   export const ID = "smithy.example#NoSuchResource";
     *   export function isa(o: any): o is NoSuchResource {
     *     return _smithy.isa(o, ID);
     *   }
     * }
     * }</pre>
     *
     * @param shape Error shape being generated.
     * @param writer Writer to write to.
     */
    private void renderErrorStructure(StructureShape shape, TypeScriptWriter writer) {
        ErrorTrait errorTrait = shape.getTrait(ErrorTrait.class).orElseThrow(IllegalStateException::new);
        Symbol symbol = symbolProvider.toSymbol(shape);
        writer.writeShapeDocs(shape);
        writer.openBlock("export interface $L extends _smithy.SmithyException {", symbol.getName());
        writer.write("__type: $S;", shape.getId());
        writer.write("$$name: $S;", shape.getId().getName());
        writer.write("$$fault: $S;", errorTrait.getValue());
        StructuredMemberWriter config = new StructuredMemberWriter(
                model, symbolProvider, shape.getAllMembers().values());
        config.writeMembers(writer, shape);
        writer.closeBlock("}"); // interface
        writer.write("");
        renderStructureNamespace(shape, writer);
    }

    private void renderStructureNamespace(StructureShape shape, TypeScriptWriter writer) {
        Symbol symbol = symbolProvider.toSymbol(shape);
        writer.openBlock("export namespace $L {", "}", symbol.getName(), () -> {
            writer.write("export const ID = $S;", shape.getId());
            writer.openBlock("export function isa(o: any): o is $L {", "}", symbol.getName(), () -> {
                writer.write("return _smithy.isa(o, ID);");
            });
        });
    }

    /**
     * Renders a TypeScript union.
     *
     * @param shape Shape to render as a union.
     * @see UnionGenerator
     */
    @Override
    public Void unionShape(UnionShape shape) {
        useWriter(shape, writer -> new UnionGenerator(model, symbolProvider, writer, shape).run());
        return null;
    }

    /**
     * Named enums are rendered as TypeScript enums.
     *
     * <p>For example, given the following Smithy model:
     *
     * <pre>{@code
     * @enum("YES": {name: "YEP"}, "NO": {name: "NOPE"})
     * string TypedYesNo
     * }</pre>
     *
     * <p>We will generate the following:
     *
     * <pre>{@code
     * export enum TypedYesNo {
     *   YES: "YEP",
     *   NO: "NOPE",
     * }
     * }</pre>
     *
     * <p>Shapes that refer to this string as a member will use the following
     * generated code:
     *
     * <pre>{@code
     * import { TypedYesNo } from "./TypedYesNo";
     *
     * interface MyStructure {
     *   "yesNo": TypedYesNo | string;
     * }
     * }</pre>
     *
     * @param shape Shape to generate.
     */
    @Override
    public Void stringShape(StringShape shape) {
        shape.getTrait(EnumTrait.class).ifPresent(trait -> {
            Symbol symbol = symbolProvider.toSymbol(shape);
            useWriter(shape, writer -> {
                // Unnamed enums generate a union of string literals.
                if (!trait.hasNames()) {
                    writer.write("export type $L = $L",
                                 symbol.getName(), TypeScriptUtils.getEnumVariants(trait.getValues().keySet()));
                } else {
                    // Named enums generate an actual enum type.
                    writer.openBlock("export enum $L {", symbol.getName());
                    trait.getValues().forEach((value, body) -> body.getName().ifPresent(name -> {
                        body.getDocumentation().ifPresent(writer::writeDocs);
                        writer.write("$L = $S,", TypeScriptUtils.sanitizePropertyName(name), value);
                    }));
                    writer.closeBlock("};");
                }
            });
        });

        // Normal string shapes don't generate any code on their own.
        return null;
    }

    @Override
    public Void serviceShape(ServiceShape shape) {
        if (!Objects.equals(service, shape)) {
            return null;
        }

        // Generate the service client itself.
        useWriter(shape, writer -> new ServiceGenerator(
                settings, model, service, symbolProvider, writer, runtimePlugins, applicationProtocol).run());

        // Generate each operation for the service.
        TopDownIndex topDownIndex = model.getKnowledge(TopDownIndex.class);
        for (OperationShape operation : topDownIndex.getContainedOperations(service)) {
            useWriter(operation, commandWriter -> new CommandGenerator(
                    settings, model, service, operation, symbolProvider,
                    commandWriter, runtimePlugins, applicationProtocol).run());
        }

        return null;
    }

    // Handles adding and removing onWriter callbacks for each shape.
    private void useWriter(Shape shape, Consumer<TypeScriptWriter> consumer) {
        TypeScriptWriter writer = writers.createWriter(shape);
        writer.pushState();

        // Allow integrations to do things like add onSection callbacks.
        // These onSection callbacks are removed when popState is called.
        for (TypeScriptIntegration integration : integrations) {
            integration.onWriter(settings, model, symbolProvider, shape, writer);
        }

        consumer.accept(writer);
        writer.popState();
    }
}
