package software.amazon.smithy.typescript.codegen.protocols.cbor;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.DocumentShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.utils.MapUtils;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CborShapeDeserVisitorTest {

    @Mock
    ProtocolGenerator.GenerationContext context;
    @Mock
    TypeScriptWriter writer;
    CborShapeDeserVisitor subject;

    @BeforeEach
    void setUp(
        @Mock TypeScriptSettings typeScriptSettings
    ) {
        lenient().when(context.getWriter()).thenReturn(writer);
        lenient().when(context.getSettings()).thenReturn(typeScriptSettings);
        lenient().when(typeScriptSettings.generateServerSdk())
            .thenReturn(false);

        subject = new CborShapeDeserVisitor(
            context
        );
    }

    @Test
    void deserializeCollection(
        @Mock CollectionShape collectionShape,
        @Mock MemberShape memberShape,
        @Mock ShapeId shapeId,
        @Mock Shape target,
        @Mock Model model
    ) {
        when(collectionShape.getMember()).thenReturn(memberShape);
        when(memberShape.getTarget()).thenReturn(shapeId);
        when(context.getModel()).thenReturn(model);
        when(model.expectShape(any(ShapeId.class)))
            .thenReturn(target);
        when(target.accept(any())).thenReturn("entry");

        subject.deserializeCollection(context, collectionShape);

        verify(writer).write(
            "const collection = (output || [])$L",
            ".filter((e: any) => e != null)"
        );
    }

    @Test
    void deserializeDocument(
        @Mock DocumentShape documentShape
    ) {
        subject.deserializeDocument(context, documentShape);
        verify(writer).write(
            """
                return output; // document.
                """
        );
    }

    @Test
    void deserializeMap(@Mock MapShape mapShape,
                        @Mock MemberShape valueShape,
                        @Mock ShapeId shapeId,
                        @Mock SymbolProvider symbolProvider,
                        @Mock Symbol symbol,
                        @Mock Shape target,
                        @Mock Model model) {
        when(mapShape.getValue()).thenReturn(valueShape);
        when(valueShape.getTarget()).thenReturn(shapeId);
        when(context.getSymbolProvider()).thenReturn(symbolProvider);
        when(context.getModel()).thenReturn(model);
        when(model.expectShape(shapeId)).thenReturn(target);
        when(symbolProvider.toSymbol(mapShape))
            .thenReturn(symbol);

        subject.deserializeMap(context, mapShape);
        verify(writer).openBlock(
            eq("return Object.entries(output).reduce((acc: $T, [key, value]: [string, any]) => {"),
            eq(""),
            eq(symbol),
            any()
        );
    }

    @Test
    void deserializeStructure(@Mock StructureShape structureShape) {
        subject.deserializeStructure(context, structureShape);

        verify(writer).addImport(
            "take", null, TypeScriptDependency.AWS_SMITHY_CLIENT
        );
        verify(writer).openBlock(
            eq("return take(output, {"),
            eq("}) as any;"),
            any()
        );
    }

    @Test
    void deserializeUnion(@Mock UnionShape unionShape,
                          @Mock MemberShape mapMember,
                          @Mock ShapeId shapeId,
                          @Mock Shape target,
                          @Mock Model model) {
        when(unionShape.getAllMembers()).thenReturn(
            MapUtils.of(
                "member", mapMember
            )
        );

        when(mapMember.getTarget()).thenReturn(shapeId);
        when(context.getModel()).thenReturn(model);
        when(model.expectShape(shapeId)).thenReturn(target);

        subject.deserializeUnion(context, unionShape);

        verify(writer).openBlock(
            eq("if ($1L != null) {"),
            eq("}"),
            eq("output.member"),
            any()
        );

        verify(writer).write(
            "return { $$unknown: Object.entries(output)[0] };"
        );
    }
}