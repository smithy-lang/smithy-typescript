/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.protocols.cbor;

import java.util.Map;
import java.util.TreeMap;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.DocumentShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.IdempotencyTokenTrait;
import software.amazon.smithy.model.traits.SparseTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.DocumentMemberSerVisitor;
import software.amazon.smithy.typescript.codegen.integration.DocumentShapeSerVisitor;
import software.amazon.smithy.typescript.codegen.integration.HttpProtocolGeneratorUtils;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.typescript.codegen.validation.UnaryFunctionCall;


public class CborShapeSerVisitor extends DocumentShapeSerVisitor {
    /**
     * The service model's timestampFormat is ignored in RPCv2 CBOR protocol.
     */
    private static final TimestampFormatTrait.Format TIMESTAMP_FORMAT = TimestampFormatTrait.Format.EPOCH_SECONDS;

    public CborShapeSerVisitor(ProtocolGenerator.GenerationContext context) {
        super(context);
        this.serdeElisionEnabled = true;
    }

    @Override
    protected void serializeCollection(ProtocolGenerator.GenerationContext context, CollectionShape shape) {
        TypeScriptWriter writer = context.getWriter();
        Shape target = context.getModel().expectShape(shape.getMember().getTarget());

        String potentialFilter = "";
        boolean hasSparseTrait = shape.hasTrait(SparseTrait.ID);
        if (!hasSparseTrait) {
            potentialFilter = ".filter((e: any) => e != null)";
        }

        String returnedExpression = target.accept(getMemberVisitor("entry"));

        if (returnedExpression.equals("entry")) {
            writer.write("return input$L;", potentialFilter);
        } else {
            writer.openBlock("return input$L.map(entry => {", "});", potentialFilter, () -> {
                if (hasSparseTrait) {
                    writer.write("if (entry === null) { return null as any; }");
                }
                writer.write("return $L;", target.accept(getMemberVisitor("entry")));
            });
        }
    }

    @Override
    protected void serializeDocument(ProtocolGenerator.GenerationContext context, DocumentShape shape) {
        context.getWriter().write("""
            return input; // document.
            """);
    }

    @Override
    protected void serializeMap(ProtocolGenerator.GenerationContext context, MapShape shape) {
        TypeScriptWriter writer = context.getWriter();
        Shape target = context.getModel().expectShape(shape.getValue().getTarget());
        SymbolProvider symbolProvider = context.getSymbolProvider();

        Symbol keySymbol = symbolProvider.toSymbol(shape.getKey());
        String entryKeyType = keySymbol.toString().equals("string")
            ? "string"
            : symbolProvider.toSymbol(shape.getKey()) + "| string";

        writer.openBlock("return Object.entries(input).reduce((acc: Record<string, any>, "
                + "[key, value]: [$1L, any]) => {", "}, {});", entryKeyType,
            () -> {
                writer.write("""
                    if (value !== null) {
                        acc[key] = $L;
                    }
                    """,
                    target.accept(getMemberVisitor("value"))
                );

                if (shape.hasTrait(SparseTrait.ID)) {
                    writer.write("""
                        else {
                            acc[key] = null as any;
                        }
                        """);
                }

                writer.write("return acc;");
            }
        );
    }

    @Override
    protected void serializeStructure(ProtocolGenerator.GenerationContext context, StructureShape shape) {
        TypeScriptWriter writer = context.getWriter();
        writer.addImport("take", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
        writer.openBlock("return take(input, {", "});", () -> {
            Map<String, MemberShape> members = new TreeMap<>(shape.getAllMembers());
            members.forEach((memberName, memberShape) -> {
                Shape target = context.getModel().expectShape(memberShape.getTarget());

                String valueExpression = (memberShape.hasTrait(TimestampFormatTrait.class)
                    ? HttpProtocolGeneratorUtils.getTimestampInputParam(
                        context, "_", memberShape, TIMESTAMP_FORMAT
                    )
                    : target.accept(getMemberVisitor("_")));

                String valueProvider = "_ => " + valueExpression;
                boolean isUnaryCall = UnaryFunctionCall.check(valueExpression);

                if (memberShape.hasTrait(IdempotencyTokenTrait.class)) {
                    writer
                        .addDependency(TypeScriptDependency.UUID_TYPES)
                        .addImport("v4", "generateIdempotencyToken", TypeScriptDependency.UUID);

                    writer.write("'$L': [true, _ => _ ?? generateIdempotencyToken()],", memberName);
                } else {
                    if (valueProvider.equals("_ => _")) {
                        writer.write("'$1L': [],", memberName);
                    } else if (isUnaryCall) {
                        writer.write("'$1L': $2L,", memberName, UnaryFunctionCall.toRef(valueExpression));
                    } else {
                        writer.write("'$1L': $2L,", memberName, valueProvider);
                    }
                }
            });
        });
    }

    @Override
    protected void serializeUnion(ProtocolGenerator.GenerationContext context, UnionShape shape) {
        TypeScriptWriter writer = context.getWriter();
        Model model = context.getModel();
        ServiceShape serviceShape = context.getService();

        writer.openBlock("return $L.visit(input, {", "});", shape.getId().getName(serviceShape), () -> {
            Map<String, MemberShape> members = new TreeMap<>(shape.getAllMembers());
            members.forEach((memberName, memberShape) -> {
                Shape target = model.expectShape(memberShape.getTarget());
                writer.write("$L: value => ({ $S: $L }),", memberName, memberName,
                    target.accept(getMemberVisitor("value")));
            });
            writer.write("_: (name, value) => ({ name: value } as any)");
        });
    }

    private DocumentMemberSerVisitor getMemberVisitor(String dataSource) {
        return new CborMemberSerVisitor(getContext(), dataSource);
    }
}
