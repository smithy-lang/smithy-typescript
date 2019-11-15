package software.amazon.smithy.typescript.codegen.integration;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

import org.junit.jupiter.api.Test;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.model.shapes.ListShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.StringShape;

public class ProtocolGeneratorTest {
    @Test
    public void sanitizesNames() {
        assertThat(ProtocolGenerator.getSanitizedName("aws.rest-json.1.1"), equalTo("Aws_restJson_1_1"));
    }

    @Test
    public void buildsSerFunctionName() {
        StringShape shape = StringShape.builder().id("com.smithy.example#Foo").build();
        Symbol symbol = Symbol.builder()
                .name("Foo")
                .namespace("com.smithy.example", ".")
                .putProperty("shape", shape)
                .build();

        assertThat(ProtocolGenerator.getSerFunctionName(symbol, "aws.rest-json.1.1"),
                equalTo("serializeAws_restJson_1_1Foo"));
    }

    @Test
    public void buildsSerFunctionNameForCollection() {
        MemberShape member = MemberShape.builder()
                .id("com.smithy.example#FooList$member")
                .target("com.smithy.example#Foo")
                .build();
        ListShape list = ListShape.builder()
                .id("com.smithy.example#FooList")
                .member(member)
                .build();
        Symbol symbol = Symbol.builder()
                .name("Array<Foo>")
                .namespace("com.smithy.example", ".")
                .putProperty("shape", list)
                .build();

        assertThat(ProtocolGenerator.getSerFunctionName(symbol, "aws.rest-json.1.1"),
                equalTo("serializeAws_restJson_1_1FooList"));
    }

    @Test
    public void buildsDeserFunctionName() {
        StringShape shape = StringShape.builder().id("com.smithy.example#Foo").build();
        Symbol symbol = Symbol.builder()
                .name("Foo")
                .namespace("com.smithy.example", ".")
                .putProperty("shape", shape)
                .build();

        assertThat(ProtocolGenerator.getDeserFunctionName(symbol, "aws.rest-json.1.1"),
                equalTo("deserializeAws_restJson_1_1Foo"));
    }

    @Test
    public void buildsDeserFunctionNameForCollection() {
        MemberShape member = MemberShape.builder()
                .id("com.smithy.example#FooList$member")
                .target("com.smithy.example#Foo")
                .build();
        ListShape list = ListShape.builder()
                .id("com.smithy.example#FooList")
                .member(member)
                .build();
        Symbol symbol = Symbol.builder()
                .name("Array<Foo>")
                .namespace("com.smithy.example", ".")
                .putProperty("shape", list)
                .build();

        assertThat(ProtocolGenerator.getDeserFunctionName(symbol, "aws.rest-json.1.1"),
                equalTo("deserializeAws_restJson_1_1FooList"));
    }

    @Test
    public void detectsCompatibleGenerators() {
        // TODO
    }

    @Test
    public void detectsIncompatibleGenerators() {
        // TODO
    }
}
