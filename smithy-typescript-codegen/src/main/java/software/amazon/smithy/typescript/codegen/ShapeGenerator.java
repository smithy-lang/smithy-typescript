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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.OperationIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.MemberShape;
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

class ShapeGenerator extends ShapeVisitor.Default<Void> {

    private final TypeScriptSettings settings;
    private final Model model;
    private final ServiceShape service;
    private final FileManifest fileManifest;
    private final SymbolProvider symbolProvider;
    private final ShapeIndex nonTraits;
    private final Map<String, TypeScriptWriter> writers = new HashMap<>();

    ShapeGenerator(PluginContext context) {
        settings = TypeScriptSettings.from(context.getSettings());
        nonTraits = context.getNonTraitShapes();
        model = context.getModel();
        service = settings.getService(model);
        fileManifest = context.getFileManifest();
        symbolProvider = TypeScriptCodegenPlugin.symbolProviderBuilder()
                .model(model)
                .targetEnvironment(settings.getEnvironment())
                .build();
    }

    void execute() {
        // Write shared / static content.
        fileManifest.writeFile("shared/sharedTypes.ts", getClass(), "shapeTypes.ts");

        // Generate models.
        nonTraits.shapes().sorted().forEach(shape -> shape.accept(this));

        // Write each pending writer.
        writers.forEach((filename, writer) -> fileManifest.writeFile(filename, writer.toString()));
    }

    @Override
    protected Void getDefault(Shape shape) {
        return null;
    }

    /**
     * Renders structures as classes.
     *
     * <p>Classes are used for structures because we plan on adding
     * inheritance to Smithy. We want developers to be able to use
     * instanceof checks to widen types at runtime.
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
        if (shape.hasTrait(ErrorTrait.class)) {
            renderErrorStructure(shape);
        } else {
            renderNonErrorStructure(shape);
        }

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
     * import { SmithyStructure as $SmithyStructure } from "../shared/shapeTypes";
     *
     * export class Person implements $SmithyStructure {
     *   readonly $namespace = "smithy.example";
     *   readonly $name = "Person";
     *   readonly name: string | undefined;
     *   readonly age?: number | null;
     *   constructor(args: {
     *     name: string | undefined;
     *     age?: number | null;
     *   }) {
     *     this.name = args.name;
     *     this.age = args.arg;
     *   }
     * }
     * }</pre>
     *
     * @param shape Structure to render.
     */
    private void renderNonErrorStructure(StructureShape shape) {
        Symbol symbol = symbolProvider.toSymbol(shape);
        TypeScriptWriter writer = getWriter(symbol.getDefinitionFile(), symbol.getNamespace());
        writer.addImport("SmithyStructure", "$SmithyStructure", "./shared/shapeTypes");
        writer.openBlock("export class $L implements $$SmithyStructure {", symbol.getName());
        writer.write("readonly $$namespace = $S;", shape.getId().getNamespace());
        writer.write("readonly $$name = $S;", shape.getId().getName());

        StructuredMemberWriter config = new StructuredMemberWriter(
                model, symbolProvider, symbol, shape.getAllMembers().values());
        config.memberPrefix = "readonly ";
        config.writeMembers(writer, shape);

        if (shape.getAllMembers().isEmpty()) {
            writer.write("constructor(args?: {}) {}");
        } else {
            writer.openBlock("constructor(args: {");
            config.memberPrefix = "";
            config.writeMembers(writer, shape);
            writer.closeBlock("}) {");
            writer.indent();
            for (MemberShape member : shape.getAllMembers().values()) {
                String memberName = symbolProvider.toMemberName(member);
                writer.write("this.$1L = args.$1L;", memberName);
            }
            writer.closeBlock("}");
        }

        writer.closeBlock("}");
    }

    /**
     * Error structures always extend from SmithyException and add the appropriate
     * fault property.
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
     * import { SmithyException as $SmithyException } from "../shared/shapeTypes";
     *
     * export class NoSuchResource extends $SmithyException {
     *   readonly resourceType: string | undefined;
     *   constructor(serviceName: string, args: {
     *     resourceType: string | undefined;
     *     message?: string;
     *   }) {
     *     super({
     *       namespace: "smithy.example",
     *       name: "NoSuchResource",
     *       fault: "client",
     *       service: serviceName
     *     });
     *     this.resourceType = args.resourceType;
     *   }
     * }
     * }</pre>
     *
     * @param shape Error shape being generated.
     */
    private void renderErrorStructure(StructureShape shape) {
        ErrorTrait errorTrait = shape.getTrait(ErrorTrait.class).orElseThrow(IllegalStateException::new);
        Symbol symbol = symbolProvider.toSymbol(shape);
        TypeScriptWriter writer = getWriter(symbol.getDefinitionFile(), symbol.getNamespace());
        writer.addImport("SmithyException", "$SmithyException", "./shared/shapeTypes");
        writer.openBlock("export class $L extends $$SmithyException {", symbol.getName());

        // Write properties.
        StructuredMemberWriter config = new StructuredMemberWriter(
                model, symbolProvider, symbol, shape.getAllMembers().values());
        config.memberPrefix = "readonly ";
        config.writeMembers(writer, shape);

        // Write constructor.
        writer.openBlock("constructor(serviceId: string, args: {");
        writer.write("message?: string;");
        config.memberPrefix = "";
        config.noDocs = true;
        config.writeMembers(writer, shape);
        writer.closeBlock("}) {");
        writer.indent();

        writer.openBlock("super({");
        writer.write("namespace: $S,", shape.getId().getNamespace());
        writer.write("name: $S,", shape.getId().getName());
        writer.write("fault: $S,", errorTrait.getValue());
        writer.write("service: serviceId,");
        writer.closeBlock("});");

        for (MemberShape member : shape.getAllMembers().values()) {
            String memberName = symbolProvider.toMemberName(member);
            writer.write("this.$1L = args.$1L;", memberName);
        }

        writer.closeBlock("}"); // constructor
        writer.closeBlock("}"); // class
    }

    /**
     * Renders a TypeScript union.
     *
     * <p>Smithy tagged unions are rendered as a set of TypeScript interfaces
     * and functionality used to visit each variant.
     *
     * <p>The {@code TaggedUnion} type wraps the generated interface to
     * allow for only a single value to be set at any given time. This also
     * allows for an unknown variant to be stored in the {@code $unknown}
     * member using a tuple of the unknown tag (a string) followed by the
     * value (an any).
     *
     * <p>For example, given the following Smithy model:
     *
     * <pre>{@code
     * union Attacker {
     *     lion: Lion,
     *     tiger: Tiger,
     *     bear: Bear,
     * }
     * }</pre>
     *
     * <p>The following code is generated:
     *
     * <pre>{@code
     * export type Attacker = TaggedUnion<{
     *   lion?: Lion;
     *   tiger?: Tiger;
     *   bear?: Bear;
     * }>;
     *
     * namespace Attacker {
     *   export interface Visitor<T> {
     *     lion: (value: Lion) => T;
     *     tiger: (value: Tiger) => T;
     *     bear: (value: Bear) => T;
     *     _: (name: string, value: any) => T;
     *   }
     *
     *   export function visit<T>(
     *     value: Attacker,
     *     visitor: Visitor<T>
     *   ): T {
     *     if ("lion" in value) return visitor.lion(value);
     *     if ("tiger" in value) return visitor.tiger(value);
     *     if ("bear" in value) return visitor.bear(visitor);
     *     return visitor.$unknown(value.$unknown[0], value.$unknown[1]);
     *   }
     * }
     * }</pre>
     *
     * <p>Important: Tagged unions in TypeScript are intentionally designed
     * so that it is forward-compatible to change a structure with optional
     * and mutually exclusive members to a taggged union.
     *
     * @param shape Shape to render as a union.
     */
    @Override
    public Void unionShape(UnionShape shape) {
        Symbol symbol = symbolProvider.toSymbol(shape);
        // Generate a normal structure prefixed with "_".
        String shadowName = "_" + symbol.getName();

        TypeScriptWriter writer = getWriter(symbol.getDefinitionFile(), symbol.getNamespace());
        writer.addImport("TaggedUnion", "./shared/shapeTypes");
        writer.openBlock("export type $L = TaggedUnion<{", symbol.getName());
        StructuredMemberWriter config = new StructuredMemberWriter(
                model, symbolProvider, symbol, shape.getAllMembers().values());
        config.interfaceName = shadowName;
        config.isPrivate = true;
        config.writeMembers(writer, shape);
        writer.closeBlock("}>;");

        writer.write("");
        writer.openBlock("namespace $L {", symbol.getName());

        // Create the visitor type for the union.
        writer.openBlock("export interface ${L}Visitor<T> {", symbol.getName());
        for (MemberShape member : shape.getAllMembers().values()) {
            String memberName = symbolProvider.toMemberName(member);
            writer.write("$L: (value: $T) => T;",
                         TypeScriptUtils.sanitizePropertyName(memberName),
                         symbolProvider.toSymbol(member));
        }
        writer.write("_: (name: string, value: any) => T;");
        writer.closeBlock("}"); // Close the visitor interface.

        // Create the visitor dispatcher for the union.
        writer.write("");
        writer.write("export function visit<T>(").indent();
        writer.write("value: $L,", symbol.getName());
        writer.write("visitor: ${1L}Visitor<T>", symbol.getName());
        writer.dedent().write("): T {").indent();
        for (MemberShape member : shape.getAllMembers().values()) {
            String memberName = symbolProvider.toMemberName(member);
            writer.write("if ($1S in value) return visitor.$1L(value.$1L);", memberName);
        }
        writer.write("return visitor._(value.$$unknown[0], value.$$unknown[1]);");
        writer.closeBlock("}"); // Close the visit() function
        writer.closeBlock("}"); // Close the visitor namespace.

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
        shape.getTrait(EnumTrait.class).filter(EnumTrait::hasNames).ifPresent(trait -> {
            Symbol symbol = symbolProvider.toSymbol(shape);
            TypeScriptWriter writer = getWriter(symbol.getDefinitionFile(), symbol.getNamespace());
            writer.openBlock("export enum $L {", symbol.getName());
            trait.getValues().forEach((value, body) -> body.getName().ifPresent(name -> {
                body.getDocumentation().ifPresent(writer::writeDocs);
                writer.write("$L = $S,", TypeScriptUtils.sanitizePropertyName(name), value);
            }));
            writer.closeBlock("};");
        });

        return null;
    }

    @Override
    public Void serviceShape(ServiceShape shape) {
        if (Objects.equals(service, shape)) {
            TopDownIndex topDownIndex = model.getKnowledge(TopDownIndex.class);
            OperationIndex operationIndex = model.getKnowledge(OperationIndex.class);
            topDownIndex.getContainedOperations(service).forEach(operationShape -> {
                // TODO: Render command
                if (!operationIndex.getErrors(operationShape).isEmpty()) {
                    // renderErrorUnion(operationIndex, operationShape);
                }
            });
        }

        return null;
    }

    // TODO: This does not need to be an exported type. Move this to the command.
    private void renderErrorUnion(OperationIndex operationIndex, OperationShape operation) {
        Symbol symbol = symbolProvider.toSymbol(operation);
        TypeScriptWriter writer = getWriter(symbol.getDefinitionFile(), symbol.getNamespace());
        List<StructureShape> errors = operationIndex.getErrors(operation);

        if (errors.size() == 0) {
            return;
        }

        writer.write("type $LExceptionsUnion =", operation.getId().getName());

        for (int i = 0; i < errors.size(); i++) {
            String endOfLine = i == errors.size() - 1 ? ";" : "";
            Symbol target = symbolProvider.toSymbol(errors.get(i));
            writer.write("  | $T$L", target, endOfLine);
        }
    }

    private TypeScriptWriter getWriter(String filename, String moduleName) {
        boolean needsNewline = writers.containsKey(filename);
        TypeScriptWriter writer = writers.computeIfAbsent(filename, f -> new TypeScriptWriter(moduleName));

        // Add newlines between types in the same file.
        if (needsNewline) {
            writer.write("");
        }

        return writer;
    }
}
