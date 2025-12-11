package software.amazon.smithy.typescript.codegen.integration;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.HttpBinding.Location;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.traits.TimestampFormatTrait.Format;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator.GenerationContext;

public class HttpProtocolGeneratorUtilsTest {
  private static final String DATA_SOURCE = "dataSource";

  @Test
  public void givesCorrectTimestampSerialization() {
    GenerationContext mockContext = new GenerationContext();
    TypeScriptWriter writer = new TypeScriptWriter("foo");
    mockContext.setWriter(writer);
    TimestampShape shape = TimestampShape.builder().id("com.smithy.example#Foo").build();

    assertThat(
        "__serializeDateTime(" + DATA_SOURCE + ")",
        equalTo(
            HttpProtocolGeneratorUtils.getTimestampInputParam(
                mockContext, DATA_SOURCE, shape, Format.DATE_TIME)));
    assertThat(
        "(" + DATA_SOURCE + ".getTime() / 1_000)",
        equalTo(
            HttpProtocolGeneratorUtils.getTimestampInputParam(
                mockContext, DATA_SOURCE, shape, Format.EPOCH_SECONDS)));
    assertThat(
        "__dateToUtcString(" + DATA_SOURCE + ")",
        equalTo(
            HttpProtocolGeneratorUtils.getTimestampInputParam(
                mockContext, DATA_SOURCE, shape, Format.HTTP_DATE)));
  }

  @Test
  public void givesCorrectTimestampDeserialization() {
    TimestampShape shape = TimestampShape.builder().id("com.smithy.example#Foo").build();
    TypeScriptWriter writer = new TypeScriptWriter("foo");

    assertThat(
        "__expectNonNull(__parseRfc3339DateTimeWithOffset(" + DATA_SOURCE + "))",
        equalTo(
            HttpProtocolGeneratorUtils.getTimestampOutputParam(
                writer, DATA_SOURCE, Location.DOCUMENT, shape, Format.DATE_TIME, false, true)));
    assertThat(
        "__expectNonNull(__parseRfc3339DateTime(" + DATA_SOURCE + "))",
        equalTo(
            HttpProtocolGeneratorUtils.getTimestampOutputParam(
                writer, DATA_SOURCE, Location.DOCUMENT, shape, Format.DATE_TIME, false, false)));
    assertThat(
        "__expectNonNull(__parseEpochTimestamp(__expectNumber(" + DATA_SOURCE + ")))",
        equalTo(
            HttpProtocolGeneratorUtils.getTimestampOutputParam(
                writer, DATA_SOURCE, Location.DOCUMENT, shape, Format.EPOCH_SECONDS, true, false)));
    assertThat(
        "__expectNonNull(__parseEpochTimestamp(" + DATA_SOURCE + "))",
        equalTo(
            HttpProtocolGeneratorUtils.getTimestampOutputParam(
                writer,
                DATA_SOURCE,
                Location.DOCUMENT,
                shape,
                Format.EPOCH_SECONDS,
                false,
                false)));
    assertThat(
        "__expectNonNull(__parseRfc7231DateTime(" + DATA_SOURCE + "))",
        equalTo(
            HttpProtocolGeneratorUtils.getTimestampOutputParam(
                writer, DATA_SOURCE, Location.DOCUMENT, shape, Format.HTTP_DATE, false, false)));
  }

  @Test
  public void writesCorrectHostPrefix() {
    GenerationContext mockContext = new GenerationContext();
    mockContext.setSymbolProvider(new MockProvider());
    TypeScriptWriter writer = new TypeScriptWriter("foo");
    mockContext.setWriter(writer);

    Model model =
        Model.assembler()
            .addImport(getClass().getResource("endpoint-trait.smithy"))
            .assemble()
            .unwrap();

    mockContext.setModel(model);

    OperationShape operation =
        (OperationShape) model.expectShape(ShapeId.from("smithy.example#GetFoo"));
    HttpProtocolGeneratorUtils.writeHostPrefix(mockContext, operation);
    assertThat(
        writer.toString(),
        containsString("let { hostname: resolvedHostname } = await context.endpoint();"));
    assertThat(writer.toString(), containsString("if (context.disableHostPrefix !== true) {"));
    assertThat(
        writer.toString(),
        containsString("resolvedHostname = \"{foo}.data.\" + resolvedHostname;"));
    assertThat(
        writer.toString(),
        containsString("resolvedHostname = resolvedHostname.replace(\"{foo}\", input.foo!)"));
    assertThat(writer.toString(), containsString("if (!__isValidHostname(resolvedHostname)) {"));
    assertThat(
        writer.toString(),
        containsString(
            "throw new Error(\"ValidationError: prefixed hostname must be hostname compatible."));
  }

  private static final class MockProvider implements SymbolProvider {
    private final String id = "com.smithy.example#Foo";
    private Symbol mock = Symbol.builder().name("Foo").namespace("com.smithy.example", "/").build();

    @Override
    public Symbol toSymbol(Shape shape) {
      return mock.toBuilder().putProperty("shape", StructureShape.builder().id(id).build()).build();
    }
  }
}
