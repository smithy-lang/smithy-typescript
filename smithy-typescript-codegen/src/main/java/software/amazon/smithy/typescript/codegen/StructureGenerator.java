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

import static software.amazon.smithy.typescript.codegen.CodegenUtils.getBlobStreamingMembers;
import static software.amazon.smithy.typescript.codegen.CodegenUtils.writeInlineStreamingMemberType;

import java.util.List;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings.RequiredMemberMode;
import software.amazon.smithy.typescript.codegen.integration.HttpProtocolGeneratorUtils;
import software.amazon.smithy.typescript.codegen.validation.SensitiveDataFinder;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Generates normal structures and error structures.
 *
 * Renders structures as interfaces.
 *
 * <p>
 * A namespace is created with the same name as the structure to
 * provide helper functionality for checking if a given value is
 * known to be of the same type as the structure. This will be
 * even more useful if/when inheritance is added to Smithy.
 *
 * <p>
 * Note that the {@code required} trait on structures is used to
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
 * <p>
 * The generator will explicitly state that a required property can
 * be set to {@code undefined}. This makes it clear that undefined checks
 * need to be made when using {@code --strictNullChecks}, but has no
 * effect otherwise.
 */
@SmithyInternalApi
final class StructureGenerator implements Runnable {

    private final Model model;
    private final SymbolProvider symbolProvider;
    private final TypeScriptWriter writer;
    private final StructureShape shape;
    private final boolean includeValidation;
    private final RequiredMemberMode requiredMemberMode;
    private final SensitiveDataFinder sensitiveDataFinder;
    private final boolean schemaMode;

    /**
     * sets 'includeValidation' to 'false' and requiredMemberMode
     * to {@link RequiredMemberMode#NULLABLE}.
     */
    StructureGenerator(Model model, SymbolProvider symbolProvider, TypeScriptWriter writer, StructureShape shape) {
        this(model, symbolProvider, writer, shape, false, RequiredMemberMode.NULLABLE, false);
    }

    StructureGenerator(
        Model model,
        SymbolProvider symbolProvider,
        TypeScriptWriter writer,
        StructureShape shape,
        boolean includeValidation,
        RequiredMemberMode requiredMemberMode,
        boolean schemaMode
    ) {
        this.model = model;
        this.symbolProvider = symbolProvider;
        this.writer = writer;
        this.shape = shape;
        this.includeValidation = includeValidation;
        this.requiredMemberMode = requiredMemberMode;
        sensitiveDataFinder = new SensitiveDataFinder(model);
        this.schemaMode = schemaMode;
    }

    @Override
    public void run() {
        if (shape.hasTrait(ErrorTrait.class)) {
            renderErrorStructure();
        } else {
            renderNonErrorStructure();
        }
    }

    /**
     * Renders a normal, non-error structure.
     *
     * <p>
     * For example, given the following Smithy model:
     *
     * <pre>
     * {@code
     * namespace smithy.example
     *
     * structure Person {
     *     &#64;required
     *     name: String,
     *     &#64;range(min: 1)
     *     age: Integer,
     * }
     * }
     * </pre>
     *
     * <p>
     * The following TypeScript is rendered:
     *
     * <pre>{@code
     * export interface Person {
     *   name: string | undefined;
     *   age?: number | null;
     * }
     *
     * export const PersonFilterSensitiveLog = (obj: Person): any => ({...obj});
     * }</pre>
     *
     * <p>
     * If validation is enabled, it generates the following:
     *
     * <pre>{@code
     * export interface Person {
     *   name: string | undefined;
     *   age?: number | null;
     * }
     *
     * export const PersonFilterSensitiveLog = (obj: Person): any => ({...obj});
     *
     * export namespace Person {
     *   export const validate = (obj: Person): ValidationFailure[] => {
     *       // validation
     *   }
     * }
     *
     * }</pre>
     */
    private void renderNonErrorStructure() {
        Symbol symbol = symbolProvider.toSymbol(shape);
        writer.writeShapeDocs(shape);

        // Find symbol references with the "extends" property.
        String extendsFrom = symbol
            .getReferences()
            .stream()
            .filter(ref -> ref.getProperty(SymbolVisitor.IMPLEMENTS_INTERFACE_PROPERTY).isPresent())
            .map(SymbolReference::getAlias)
            .collect(Collectors.joining(", "));

        if (extendsFrom.isEmpty()) {
            writer.openBlock("export interface $L {", symbol.getName());
        } else {
            writer.openBlock("export interface $L extends $L {", symbol.getName(), extendsFrom);
        }

        StructuredMemberWriter config = new StructuredMemberWriter(
            model,
            symbolProvider,
            shape.getAllMembers().values(),
            this.requiredMemberMode,
            sensitiveDataFinder
        );
        config.writeMembers(writer, shape);
        writer.closeBlock("}");
        writer.write("");
        renderStructureNamespace(config, includeValidation);
    }

    private void renderStructureNamespace(StructuredMemberWriter structuredMemberWriter, boolean includeValidation) {
        Symbol symbol = symbolProvider.toSymbol(shape);
        String objectParam = "obj";

        if (sensitiveDataFinder.findsSensitiveDataIn(shape) && !schemaMode) {
            writer.writeDocs("@internal");
            writer.openBlock(
                "export const $LFilterSensitiveLog = ($L: $L): any => ({",
                "})",
                symbol.getName(),
                objectParam,
                symbol.getName(),
                () -> {
                    structuredMemberWriter.writeFilterSensitiveLog(writer, objectParam);
                }
            );
        }

        if (!includeValidation) {
            return;
        }

        writer.openBlock("export namespace $L {", "}", symbol.getName(), () -> {
            structuredMemberWriter.writeMemberValidatorCache(writer, "memberValidators");

            writer.addImport("ValidationFailure", "__ValidationFailure", TypeScriptDependency.SERVER_COMMON);
            writer.writeDocs("@internal");
            List<MemberShape> blobStreamingMembers = getBlobStreamingMembers(model, shape);
            writer.writeInline("export const validate = ($L: ", objectParam);
            if (blobStreamingMembers.isEmpty()) {
                writer.writeInline("$L", symbol.getName());
            } else {
                writeInlineStreamingMemberType(writer, symbol, blobStreamingMembers.get(0));
            }
            writer.openBlock(", path: string = \"\"): __ValidationFailure[] => {", "}", () -> {
                structuredMemberWriter.writeMemberValidatorFactory(writer, "memberValidators");
                structuredMemberWriter.writeValidateMethodContents(writer, objectParam);
            });
        });
    }

    /**
     * Error structures generate classes that extend from service base exception
     * (ServiceException in case of server SDK), and add the appropriate fault
     * property.
     *
     * <p>
     * Given the following Smithy structure:
     *
     * <pre>
     * {@code
     * namespace smithy.example
     *
     * &#64;error("client")
     * structure NoSuchResource {
     *     &#64;required
     *     resourceType: String
     * }
     * }
     * </pre>
     *
     * <p>
     * The following TypeScript is generated:
     *
     * <pre>{@code
     * import { ExceptionOptionType as __ExceptionOptionType } from "@smithy/smithy-client";
     * import { FooServiceException as __BaseException } from "./FooServiceException";
     * // In server SDK:
     * // import { ServiceException as __BaseException } from "@aws-smithy/server-common";
     *
     * export class NoSuchResource extends __BaseException {
     *   name: "NoSuchResource";
     *   $fault: "client";
     *   resourceType: string | undefined;
     *   // @internal
     *   constructor(opts: __ExceptionOptionType<NoSuchResource, __BaseException>) {
     *     super({
     *       name: "NoSuchResource",
     *       $fault: "client",
     *       ...opts
     *     });
     *     Object.setPrototypeOf(this, NoSuchResource.prototype);
     *     this.resourceType = opts.resourceType;
     *   }
     * }
     * }</pre>
     */
    private void renderErrorStructure() {
        ErrorTrait errorTrait = shape.getTrait(ErrorTrait.class).orElseThrow(IllegalStateException::new);
        Symbol symbol = symbolProvider.toSymbol(shape);
        writer.writeShapeDocs(shape);
        boolean isServerSdk = this.includeValidation;
        writer.openBlock("export class $T extends $L {", symbol, "__BaseException");
        writer.write("readonly name = $1S as const;", shape.getId().getName());
        writer.write("readonly $$fault = $1S as const;", errorTrait.getValue());
        if (!isServerSdk) {
            HttpProtocolGeneratorUtils.writeRetryableTrait(writer, shape, ";");
        }
        StructuredMemberWriter structuredMemberWriter = new StructuredMemberWriter(
            model,
            symbolProvider,
            shape.getAllMembers().values(),
            this.requiredMemberMode,
            sensitiveDataFinder
        );
        // since any error interface must extend from JavaScript Error interface,
        // message member is already
        // required in the JavaScript Error interface
        structuredMemberWriter.skipMembers.add("message");
        structuredMemberWriter.writeMembers(writer, shape);
        structuredMemberWriter.writeErrorConstructor(writer, shape, isServerSdk);
        writer.closeBlock("}");
        writer.write("");
    }
}
