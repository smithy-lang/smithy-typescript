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
        TimestampShape shape = TimestampShape.builder().id("com.smithy.example#Foo").build();

        assertThat(DATA_SOURCE + ".toISOString()",
                equalTo(HttpProtocolGeneratorUtils.getTimestampInputParam(DATA_SOURCE, shape, Format.DATE_TIME)));
        assertThat("Math.round(" + DATA_SOURCE + ".getTime() / 1000)",
                equalTo(HttpProtocolGeneratorUtils.getTimestampInputParam(DATA_SOURCE, shape, Format.EPOCH_SECONDS)));
        assertThat(DATA_SOURCE + ".toUTCString()",
                equalTo(HttpProtocolGeneratorUtils.getTimestampInputParam(DATA_SOURCE, shape, Format.HTTP_DATE)));
    }

    @Test
    public void givesCorrectTimestampDeserialization() {
        TimestampShape shape = TimestampShape.builder().id("com.smithy.example#Foo").build();

        assertThat("new Date(" + DATA_SOURCE + ")",
                equalTo(HttpProtocolGeneratorUtils.getTimestampOutputParam(DATA_SOURCE, Location.DOCUMENT, shape, Format.DATE_TIME)));
        assertThat("new Date(Math.round(" + DATA_SOURCE + " * 1000))",
                equalTo(HttpProtocolGeneratorUtils.getTimestampOutputParam(DATA_SOURCE, Location.DOCUMENT, shape, Format.EPOCH_SECONDS)));
        assertThat("new Date(" + DATA_SOURCE + ")",
                equalTo(HttpProtocolGeneratorUtils.getTimestampOutputParam(DATA_SOURCE, Location.DOCUMENT, shape, Format.HTTP_DATE)));
    }

    @Test
    public void writesCorrectHostPrefix() {
        GenerationContext mockContext = new GenerationContext();
        mockContext.setSymbolProvider(new MockProvider());
        TypeScriptWriter writer = new TypeScriptWriter("foo");
        mockContext.setWriter(writer);

        Model model = Model.assembler()
                .addImport(getClass().getResource("endpoint-trait.smithy"))
                .assemble()
                .unwrap();

        mockContext.setModel(model);

        OperationShape operation = (OperationShape) model.expectShape(ShapeId.from("smithy.example#GetFoo"));
        HttpProtocolGeneratorUtils.writeHostPrefix(mockContext, operation);
        assertThat(writer.toString(), containsString("let resolvedHostname = (context.endpoint as any).hostname;"));
        assertThat(writer.toString(), containsString("if (context.disableHostPrefix !== true) {"));
        assertThat(writer.toString(), containsString("resolvedHostname = \"{foo}.data.\" + resolvedHostname;"));
        assertThat(writer.toString(), containsString("resolvedHostname = resolvedHostname.replace(\"{foo}\", input.foo)"));
        assertThat(writer.toString(), containsString("if (!__isValidHostname(resolvedHostname)) {"));
        assertThat(writer.toString(), containsString(
                "throw new Error(\"ValidationError: prefixed hostname must be hostname compatible."));
    }

    private static final class MockProvider implements SymbolProvider {
        private final String id = "com.smithy.example#Foo";
        private Symbol mock = Symbol.builder()
                .name("Foo")
                .namespace("com.smithy.example", "/")
                .build();

        @Override
        public Symbol toSymbol(Shape shape) {
            return mock.toBuilder().putProperty("shape",
                    StructureShape.builder().id(id).build()).build();
        }
    }
}
