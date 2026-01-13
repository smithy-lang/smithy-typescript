/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import java.util.Map;
import java.util.TreeMap;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings.RequiredMemberMode;
import software.amazon.smithy.typescript.codegen.knowledge.ServiceClosure;
import software.amazon.smithy.typescript.codegen.validation.SensitiveDataFinder;
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.utils.StringUtils;

/**
 * Renders a TypeScript union.
 *
 * <p>
 * Smithy tagged unions are rendered as a set of TypeScript interfaces
 * and functionality used to visit each variant. Only a single member
 * can be set at any given time. A member that contains unknown variants
 * is automatically added to each tagged union. If set, it contains the
 * name of the property that was set and its value stored as an
 * {@code any}.
 *
 * <p>
 * A {@code Visitor} interface and a method used to dispatch to the
 * visitor is generated for each tagged union. This allows for working
 * with tagged unions functionally and account for each variant in a
 * typed way.
 *
 * <p>
 * For example, given the following Smithy model:
 *
 * <pre>{@code
 * union Attacker {
 *     lion: Lion,
 *     tiger: Tiger,
 *     bear: Bear,
 * }
 * }</pre>
 *
 * <p>
 * The following code is generated:
 *
 * <pre>{@code
 * export type Attacker =
 *   | Attacker.LionMember
 *   | Attacker.TigerMember
 *   | Attacker.BearMember
 *   | Attacker.$UnknownMember;
 *
 * export namespace Attacker {
 *
 *   export interface LionMember {
 *     lion: Lion;
 *     tiger?: never;
 *     bear?: never;
 *     $unknown?: never;
 *   }
 *
 *   export interface TigerMember {
 *     lion?: never;
 *     tiger?: Tiger;
 *     bear?: never;
 *     $unknown?: never;
 *   }
 *
 *   export interface BearMember {
 *     lion?: never;
 *     tiger?: never;
 *     bear: Bear;
 *     $unknown: never;
 *   }
 *
 *   export interface $UnknownMember {
 *     lion?: never;
 *     tiger?: never;
 *     bear?: never;
 *     $unknown: [string, any];
 *   }
 *
 *   export interface Visitor<T> {
 *     lion: (value: Lion) => T;
 *     tiger: (value: Tiger) => T;
 *     bear: (value: Bear) => T;
 *     _: (name: string, value: any) => T;
 *   }
 *
 *   export const visit = <T>(
 *     value: Attacker,
 *     visitor: Visitor<T>
 *   ): T => {
 *     if (value.lion !== undefined) return visitor.lion(value.lion);
 *     if (value.tiger !== undefined) return visitor.tiger(value.tiger);
 *     if (value.bear !== undefined) return visitor.bear(value.bear);
 *     return visitor._(value.$unknown[0], value.$unknown[1]);
 *   }
 * }
 *
 * export const AttackerFilterSensitiveLog = (obj: Attacker) => {
 *   if (obj.lion !== undefined)
 *     return { lion: Lion.filterSensitiveLog(obj.lion) };
 *   if (obj.tiger !== undefined)
 *     return { tiger: Tiger.filterSensitiveLog(obj.tiger) };
 *   if (obj.bear !== undefined)
 *     return { bear: Bear.filterSensitiveLog(obj.bear) };
 *   if (obj.$unknown !== undefined)
 *     return { [obj.$unknown[0]]: 'UNKNOWN' };
 * }
 *
 * }</pre>
 *
 * <p>
 * Important: Tagged unions in TypeScript are intentionally designed
 * so that it is forward-compatible to change a structure with optional
 * and mutually exclusive members to a tagged union.
 */
@SmithyInternalApi
final class UnionGenerator implements Runnable {

    private final Model model;
    private final SymbolProvider symbolProvider;
    private final TypeScriptWriter writer;
    private final Symbol symbol;
    private final UnionShape shape;
    private final Map<String, String> variantMap;
    private final boolean includeValidation;
    private final SensitiveDataFinder sensitiveDataFinder;
    private final boolean schemaMode;
    private final ServiceClosure closure;

    /**
     * sets 'includeValidation' to 'false' for backwards compatibility.
     */
    UnionGenerator(
        Model model,
        TypeScriptSettings settings,
        SymbolProvider symbolProvider,
        TypeScriptWriter writer,
        UnionShape shape
    ) {
        this(model, settings, symbolProvider, writer, shape, false, false);
    }

    UnionGenerator(
        Model model,
        TypeScriptSettings settings,
        SymbolProvider symbolProvider,
        TypeScriptWriter writer,
        UnionShape shape,
        boolean includeValidation,
        boolean schemaMode
    ) {
        this.shape = shape;
        this.symbol = symbolProvider.toSymbol(shape);
        this.model = model;
        this.symbolProvider = symbolProvider;
        this.writer = writer;
        this.includeValidation = includeValidation;
        sensitiveDataFinder = new SensitiveDataFinder(model);

        variantMap = new TreeMap<>();
        for (MemberShape member : shape.getAllMembers().values()) {
            String variant = StringUtils.capitalize(symbolProvider.toMemberName(member)) + "Member";
            variantMap.put(member.getMemberName(), variant);
        }
        this.schemaMode = schemaMode;
        this.closure = ServiceClosure.of(model, settings.getService(model));
    }

    @Override
    public void run() {
        // Write out the union type of all variants.
        writer.writeShapeDocs(shape);

        writer.openBlock("export type $L = ", "", symbol.getName(), () -> {
            for (String variant : variantMap.values()) {
                writer.write("| $L.$L", symbol.getName(), variant);
            }
            writer.write("| $L.$$UnknownMember;", symbol.getName());
        });

        // Write out the namespace that contains each variant and visitor.
        writer
            .writeDocs("@public")
            .openBlock("export namespace $L {", "}", symbol.getName(), () -> {
                writeUnionMemberInterfaces();
                writeVisitorType();
                writeVisitorFunction();
                if (includeValidation) {
                    writeValidate();
                }
                writer.unwrite("\n");
            });
        writeFilterSensitiveLog(symbol.getName());
    }

    private void writeUnionMemberInterfaces() {
        for (MemberShape member : shape.getAllMembers().values()) {
            String name = variantMap.get(member.getMemberName());
            writer.writeMemberDocs(model, member);
            writer.openBlock("export interface $L {", "}", name, () -> {
                for (MemberShape variantMember : shape.getAllMembers().values()) {
                    if (variantMember.getMemberName().equals(member.getMemberName())) {
                        writer.write(
                            "$L: $T;",
                            symbolProvider.toMemberName(variantMember),
                            symbolProvider.toSymbol(variantMember)
                        );
                    } else {
                        writer.write("$L?: never;", symbolProvider.toMemberName(variantMember));
                    }
                }
                writer.write("$$unknown?: never;");
            });
            writer.write("");
        }

        // Write out the unknown variant.
        writer.writeDocs("@public");
        writer.openBlock("export interface $$UnknownMember {", "}", () -> {
            for (MemberShape member : shape.getAllMembers().values()) {
                writer.write("$L?: never;", symbolProvider.toMemberName(member));
            }
            writer.write("$$unknown: [string, any];");
        });
        writer.write("");
    }

    private void writeVisitorType() {
        if (schemaMode) {
            writer.writeDocs(
                """
                @deprecated unused in schema-serde mode.
                """
            );
        }
        writer.openBlock("export interface Visitor<T> {", "}", () -> {
            for (MemberShape member : shape.getAllMembers().values()) {
                writer.write(
                    "$L: (value: $T) => T;",
                    symbolProvider.toMemberName(member),
                    symbolProvider.toSymbol(member)
                );
            }
            writer.write("_: (name: string, value: any) => T;");
        });
        writer.write("");
    }

    private void writeVisitorFunction() {
        if (!schemaMode) {
            // Create the visitor dispatcher for the union.
            writer.writeInline("export const visit = <T>(");
            writer.writeInline("value: $L, ", symbol.getName());
            writer.writeInline("visitor: Visitor<T>");
            writer.write("): T => {").indent();
            for (MemberShape member : shape.getAllMembers().values()) {
                String memberName = symbolProvider.toMemberName(member);
                writer.write("if (value.${1L} !== undefined) return visitor.$1L(value.${1L});", memberName);
            }
            writer.write("return visitor._(value.$$unknown[0], value.$$unknown[1]);");
            writer.dedent().write("};");
            writer.write("");
        }
    }

    private void writeFilterSensitiveLog(String namespace) {
        if (sensitiveDataFinder.findsSensitiveDataIn(shape) && !schemaMode) {
            String objectParam = "obj";
            writer.writeDocs("@internal");
            writer.openBlock(
                "export const $LFilterSensitiveLog = ($L: $L): any => {",
                "}",
                namespace,
                objectParam,
                symbol.getName(),
                () -> {
                    for (MemberShape member : shape.getAllMembers().values()) {
                        String memberName = symbolProvider.toMemberName(member);
                        StructuredMemberWriter structuredMemberWriter = new StructuredMemberWriter(
                            model,
                            closure,
                            symbolProvider,
                            shape.getAllMembers().values(),
                            RequiredMemberMode.NULLABLE,
                            sensitiveDataFinder
                        );

                        writer.writeInline(
                            """
                            if (${1L}.${2L} !== undefined) {
                              return {
                                ${2L}:\s""",
                            objectParam,
                            memberName
                        );
                        String memberParam = String.format("%s.%s", objectParam, memberName);
                        writer.indent(2);
                        structuredMemberWriter.writeMemberFilterSensitiveLog(writer, member, memberParam);
                        writer.dedent(1);
                        writer.write("};");
                        writer.dedent(1);
                        writer.write("}");
                    }
                    writer.write(
                        "if (${1L}.$$unknown !== undefined) return { [${1L}.$$unknown[0]]: \"UNKNOWN\" };",
                        objectParam
                    );
                }
            );
        }
    }

    private void writeValidate() {
        StructuredMemberWriter structuredMemberWriter = new StructuredMemberWriter(
            model,
            closure,
            symbolProvider,
            shape.getAllMembers().values(),
            RequiredMemberMode.NULLABLE,
            sensitiveDataFinder
        );

        structuredMemberWriter.writeMemberValidatorCache(writer, "memberValidators");

        writer.addImport("ValidationFailure", "__ValidationFailure", TypeScriptDependency.SERVER_COMMON);
        writer.writeDocs("@internal");
        writer.openBlock(
            "export const validate = ($L: $L, path: string = \"\"): __ValidationFailure[] => {",
            "}",
            "obj",
            symbol.getName(),
            () -> {
                structuredMemberWriter.writeMemberValidatorFactory(writer, "memberValidators");
                structuredMemberWriter.writeValidateMethodContents(writer, "obj");
            }
        );
    }
}
