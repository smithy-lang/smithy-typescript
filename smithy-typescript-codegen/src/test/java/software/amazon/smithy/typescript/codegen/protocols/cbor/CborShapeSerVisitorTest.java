package software.amazon.smithy.typescript.codegen.protocols.cbor;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;

@ExtendWith(MockitoExtension.class)
class CborShapeSerVisitorTest {

  CborShapeSerVisitor subject;

  @Mock ProtocolGenerator.GenerationContext context;
  @Mock TypeScriptWriter writer;

  @BeforeEach
  void setUp(
      @Mock Model model,
      @Mock Shape shape,
      @Mock SymbolProvider symbolProvider,
      @Mock Symbol symbol) {
    lenient().when(context.getWriter()).thenReturn(writer);
    lenient().when(context.getSymbolProvider()).thenReturn(symbolProvider);
    lenient().when(symbolProvider.toSymbol(any())).thenReturn(symbol);
    lenient().when(symbol.toString()).thenReturn("string");
    lenient().when(context.getModel()).thenReturn(model);
    lenient().when(model.expectShape(any(ShapeId.class))).thenReturn(shape);
    lenient().when(shape.accept(any(CborMemberSerVisitor.class))).thenReturn("entry");

    subject = new CborShapeSerVisitor(context);
  }

  @Test
  void serializeCollection(
      @Mock CollectionShape collectionShape, @Mock MemberShape memberShape, @Mock ShapeId shapeId) {
    when(collectionShape.getMember()).thenReturn(memberShape);
    when(memberShape.getTarget()).thenReturn(shapeId);

    subject.serializeCollection(context, collectionShape);
    verify(writer).write("return input$L;", ".filter((e: any) => e != null)");
  }

  @Test
  void serializeDocument(@Mock DocumentShape documentShape) {
    subject.serializeDocument(context, documentShape);
    verify(writer)
        .write(
            """
            return input; // document.
            """);
  }

  @Test
  void serializeMap(@Mock MapShape mapShape, @Mock MemberShape valueShape, @Mock ShapeId shapeId) {
    when(mapShape.getValue()).thenReturn(valueShape);
    when(valueShape.getTarget()).thenReturn(shapeId);

    subject.serializeMap(context, mapShape);
    verify(writer)
        .openBlock(
            eq(
                "return Object.entries(input).reduce((acc: Record<string, any>, [key, value]: [$1L,"
                    + " any]) => {"),
            eq("}, {});"),
            eq("string"),
            any());
  }

  @Test
  void serializeStructure(@Mock StructureShape structureShape) {
    subject.serializeStructure(context, structureShape);
    verify(writer).addImport("take", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
    verify(writer).openBlock(eq("return take(input, {"), eq("});"), any());
  }

  @Test
  void serializeUnion(
      @Mock UnionShape unionShape, @Mock ServiceShape service, @Mock ShapeId shapeId) {
    when(context.getService()).thenReturn(service);
    when(unionShape.getId()).thenReturn(shapeId);
    when(shapeId.getName(service)).thenReturn("name");

    subject.serializeUnion(context, unionShape);

    verify(writer).openBlock(eq("return $L.visit(input, {"), eq("});"), eq("name"), any());
  }
}
