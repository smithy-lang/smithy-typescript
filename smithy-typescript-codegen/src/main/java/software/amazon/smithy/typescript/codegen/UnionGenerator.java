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

import java.util.Map;
import java.util.TreeMap;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.utils.StringUtils;

/**
 * Renders a TypeScript union.
 *
 * <p>Smithy tagged unions are rendered as a set of TypeScript interfaces
 * and functionality used to visit each variant. Only a single member
 * can be set at any given time. A member that contains unknown variants
 * is automatically added to each tagged union. If set, it contains the
 * name of the property that was set and its value stored as an
 * {@code any}.
 *
 * <p>A {@code Visitor} interface and a method used to dispatch to the
 * visitor is generated for each tagged union. This allows for working
 * with tagged unions functionally and account for each variant in a
 * typed way.
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
 *
 *   export const filterSensitiveLog = (obj: Attacker) => {
 *     if (obj.lion !== undefined)
 *       return { lion: Lion.filterSensitiveLog(obj.lion) };
 *     if (obj.tiger !== undefined)
 *       return { tiger: Tiger.filterSensitiveLog(obj.tiger) };
 *     if (obj.bear !== undefined)
 *       return { bear: Bear.filterSensitiveLog(obj.bear) };
 *     if (obj.$unknown !== undefined)
 *       return { [obj.$unknown[0]]: 'UNKNOWN' };
 *   }
 * }
 * }</pre>
 *
 * <p>Important: Tagged unions in TypeScript are intentionally designed
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

    /**
     * sets 'includeValidation' to 'false' for backwards compatibility.
     */
    UnionGenerator(Model model, SymbolProvider symbolProvider, TypeScriptWriter writer, UnionShape shape) {
        this(model, symbolProvider, writer, shape, false);
    }

    UnionGenerator(Model model,
                   SymbolProvider symbolProvider,
                   TypeScriptWriter writer,
                   UnionShape shape,
                   boolean includeValidation) {
        this.shape = shape;
        this.symbol = symbolProvider.toSymbol(shape);
        this.model = model;
        this.symbolProvider = symbolProvider;
        this.writer = writer;
        this.includeValidation = includeValidation;

        variantMap = new TreeMap<>();
        for (MemberShape member : shape.getAllMembers().values()) {
            String variant = StringUtils.capitalize(symbolProvider.toMemberName(member)) + "Member";
            variantMap.put(member.getMemberName(), variant);
        }
    }

    @Override
    public void run() {
        // Write out the union type of all variants.
        writer.writeShapeDocs(shape);

        writer.openBlock("export type $L = ", "", symbol.getName(), () -> {
            for (String variant : variantMap.values()) {
                writer.write("| $L.$L", symbol.getName(), variant);
            }
            writer.write("| $L.$$UnknownMember", symbol.getName());
        });

        // Write out the namespace that contains each variant and visitor.
        writer.openBlock("export namespace $L {", "}", symbol.getName(), () -> {
            writeUnionMemberInterfaces();
            writeVisitorType();
            writeVisitorFunction();
            writeFilterSensitiveLog();
            if (includeValidation) {
                writeValidate();
            }
        });
    }

    private void writeUnionMemberInterfaces() {
        writer.write("");

        for (MemberShape member : shape.getAllMembers().values()) {
            String name = variantMap.get(member.getMemberName());
            writer.writeMemberDocs(model, member);
            writer.openBlock("export interface $L {", "}", name, () -> {
                for (MemberShape variantMember : shape.getAllMembers().values()) {
                    if (variantMember.getMemberName().equals(member.getMemberName())) {
                        writer.write("$L: $T;", symbolProvider.toMemberName(variantMember),
                                     symbolProvider.toSymbol(variantMember));
                    } else {
                        writer.write("$L?: never;", symbolProvider.toMemberName(variantMember));
                    }
                }
                writer.write("$$unknown?: never;");
            });
            writer.write("");
        }

        // Write out the unknown variant.
        writer.openBlock("export interface $$UnknownMember {", "}", () -> {
            for (MemberShape member : shape.getAllMembers().values()) {
                writer.write("$L?: never;", symbolProvider.toMemberName(member));
            }
            writer.write("$$unknown: [string, any];");
        });
        writer.write("");
    }

    private void writeVisitorType() {
        writer.openBlock("export interface Visitor<T> {", "}", () -> {
            for (MemberShape member : shape.getAllMembers().values()) {
                writer.write("$L: (value: $T) => T;",
                             symbolProvider.toMemberName(member), symbolProvider.toSymbol(member));
            }
            writer.write("_: (name: string, value: any) => T;");
        });
        writer.write("");
    }

    private void writeVisitorFunction() {
        // Create the visitor dispatcher for the union.
        writer.write("export const visit = <T>(").indent();
        writer.write("value: $L,", symbol.getName());
        writer.write("visitor: Visitor<T>");
        writer.dedent().write("): T => {").indent();
        for (MemberShape member : shape.getAllMembers().values()) {
            String memberName = symbolProvider.toMemberName(member);
            writer.write("if (value.${1L} !== undefined) return visitor.$1L(value.${1L});", memberName);
        }
        writer.write("return visitor._(value.$$unknown[0], value.$$unknown[1]);");
        writer.dedent().write("}");
        writer.write("");
    }

    private void writeFilterSensitiveLog() {
        String objectParam = "obj";
        writer.writeDocs("@internal");
        writer.openBlock("export const filterSensitiveLog = ($L: $L): any => {", "}",
            objectParam, symbol.getName(),
            () -> {
                for (MemberShape member : shape.getAllMembers().values()) {
                    String memberName = symbolProvider.toMemberName(member);
                    StructuredMemberWriter structuredMemberWriter = new StructuredMemberWriter(
                            model, symbolProvider, shape.getAllMembers().values());
                    writer.openBlock("if (${1L}.${2L} !== undefined) return {${2L}: ", "};",
                        objectParam, memberName, () -> {
                            String memberParam = String.format("%s.%s", objectParam, memberName);
                            structuredMemberWriter.writeMemberFilterSensitiveLog(writer, member, memberParam);
                        }
                    );
                }
                writer.write("if (${1L}.$$unknown !== undefined) return {[${1L}.$$unknown[0]]: 'UNKNOWN'};",
                    objectParam);
            }
        );
    }

    private void writeValidate() {
        StructuredMemberWriter structuredMemberWriter = new StructuredMemberWriter(
                model, symbolProvider, shape.getAllMembers().values());

        structuredMemberWriter.writeMemberValidators(writer);

        writer.addImport("ValidationFailure", "__ValidationFailure", "@aws-smithy/server-common");
        writer.openBlock("export const validate = ($L: $L): __ValidationFailure[] => {", "}",
                "obj", symbol.getName(),
                () -> {
                    structuredMemberWriter.writeValidate(writer, "obj");
                }
        );
    }
}
