/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.protocols.cbor;

import java.util.Map;
import java.util.TreeMap;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.DocumentShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.NumberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.SparseTrait;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.DocumentShapeDeserVisitor;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.typescript.codegen.util.PropertyAccessor;
import software.amazon.smithy.typescript.codegen.validation.UnaryFunctionCall;


public class CborShapeDeserVisitor extends DocumentShapeDeserVisitor {

    public CborShapeDeserVisitor(ProtocolGenerator.GenerationContext context) {
        super(context);
        this.serdeElisionEnabled = true;
    }

    @Override
    protected void deserializeCollection(ProtocolGenerator.GenerationContext context, CollectionShape shape) {
        TypeScriptWriter writer = context.getWriter();
        Shape target = context.getModel().expectShape(shape.getMember().getTarget());

        String potentialFilter = "";
        if (!shape.hasTrait(SparseTrait.ID)) {
            potentialFilter = ".filter((e: any) => e != null)";
        }
        final String filterExpression = potentialFilter;

        String returnExpression = target.accept(getMemberVisitor("entry"));

        if (returnExpression.equals("entry")) {
            writer.write("const collection = (output || [])$L", filterExpression);
        } else {
            writer.openBlock(
                "const collection = (output || [])$L.map((entry: any) => {",
                "});",
                filterExpression, () -> {
                    if (filterExpression.isEmpty()) {
                        writer.openBlock("if (entry === null) {", "}", () -> {
                            if (!shape.hasTrait(SparseTrait.ID)) {
                                writer.write(
                                    "throw new TypeError('All elements of the non-sparse list $S must be non-null.');",
                                    shape.getId()
                                );
                            } else {
                                writer.write("return null as any;");
                            }
                        });
                    }

                    writer.write("return $L$L;",
                        target.accept(getMemberVisitor("entry")),
                        usesExpect(target) ? " as any" : ""
                    );
                }
            );
        }

        writer.write("return collection;");
    }

    @Override
    protected void deserializeDocument(ProtocolGenerator.GenerationContext context, DocumentShape shape) {
        context.getWriter().write("""
            return output; // document.
            """);
    }

    @Override
    protected void deserializeMap(ProtocolGenerator.GenerationContext context, MapShape shape) {
        TypeScriptWriter writer = context.getWriter();
        Shape target = context.getModel().expectShape(shape.getValue().getTarget());
        SymbolProvider symbolProvider = context.getSymbolProvider();

        writer.openBlock("return Object.entries(output).reduce((acc: $T, [key, value]: [string, any]) => {",
            "",
            symbolProvider.toSymbol(shape),
            () -> {
                writer.openBlock("if (value !== null) {", "}", () -> {
                    writer.write("acc[key as $T] = $L$L",
                        symbolProvider.toSymbol(shape.getKey()),
                        target.accept(getMemberVisitor("value")),
                        usesExpect(target) ? " as any;" : ";"
                    );
                });

                if (shape.hasTrait(SparseTrait.ID)) {
                    writer.write("else {")
                        .indent();
                    writer.write("acc[key as $T] = null as any;", symbolProvider.toSymbol(shape.getKey()))
                        .dedent();
                    writer.write("}");
                }

                writer.write("return acc;");
            }
        );
        writer.writeInline("}, {} as $T);", symbolProvider.toSymbol(shape));
    }

    @Override
    protected void deserializeStructure(ProtocolGenerator.GenerationContext context, StructureShape shape) {
        TypeScriptWriter writer = context.getWriter();

        Map<String, MemberShape> members = new TreeMap<>(shape.getAllMembers());
        writer.addImport("take", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
        writer.openBlock("return take(output, {", "}) as any;", () -> {
            members.forEach((memberName, memberShape) -> {
                Shape target = context.getModel().expectShape(memberShape.getTarget());

                String propertyAccess = PropertyAccessor.getFrom("output", memberName);
                String value = target.accept(getMemberVisitor("_"));

                if (usesExpect(target)) {
                    if (UnaryFunctionCall.check(value)) {
                        writer.write("'$L': $L,", memberName, UnaryFunctionCall.toRef(value));
                    } else {
                        writer.write("'$L': $L,", memberName, "_ => " + value);
                    }
                } else {
                    String valueExpression = target.accept(getMemberVisitor(propertyAccess));

                    if (valueExpression.equals(propertyAccess)) {
                        writer.write("'$1L': [],", memberName);
                    } else {
                        String functionExpression = value;
                        boolean isUnaryCall = UnaryFunctionCall.check(functionExpression);
                        if (isUnaryCall) {
                            writer.write("'$1L': $2L,",
                                memberName,
                                UnaryFunctionCall.toRef(functionExpression)
                            );
                        } else {
                            writer.write("'$1L': (_: any) => $2L,",
                                memberName,
                                functionExpression
                            );
                        }
                    }
                }
            });
        });
    }

    @Override
    protected void deserializeUnion(ProtocolGenerator.GenerationContext context, UnionShape shape) {
        TypeScriptWriter writer = context.getWriter();
        Model model = context.getModel();

        Map<String, MemberShape> members = new TreeMap<>(shape.getAllMembers());

        members.forEach((memberName, memberShape) -> {
            Shape target = model.expectShape(memberShape.getTarget());

            String memberValue = target.accept(
                getMemberVisitor(PropertyAccessor.getFrom("output", memberName))
            );

            if (usesExpect(target)) {
                writer.openBlock("if ($L !== undefined) {", "}", memberValue, () -> {
                    writer.write("return { $L: $L as any }", memberName, memberValue);
                });
            } else {
                writer.openBlock(
                    "if ($1L != null) {", "}",
                    PropertyAccessor.getFrom("output", memberName),
                    () -> {
                        writer.write("""
                            return {
                              $L: $L
                            }
                            """,
                            memberName, memberValue
                        );
                    }
                );
            }
        });
        writer.write("return { $$unknown: Object.entries(output)[0] };");
    }

    private CborMemberDeserVisitor getMemberVisitor(String dataSource) {
        return new CborMemberDeserVisitor(
            getContext(), dataSource
        );
    }

    private boolean usesExpect(Shape shape) {
        return shape.isStringShape() || shape.isBooleanShape()
            || (shape instanceof NumberShape && !shape.isBigDecimalShape() && !shape.isBigIntegerShape());
    }
}
