package software.amazon.smithy.typescript.codegen.integration;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

import java.util.Collection;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.shapes.BigDecimalShape;
import software.amazon.smithy.model.shapes.BigIntegerShape;
import software.amazon.smithy.model.shapes.BlobShape;
import software.amazon.smithy.model.shapes.BooleanShape;
import software.amazon.smithy.model.shapes.ByteShape;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.DocumentShape;
import software.amazon.smithy.model.shapes.DoubleShape;
import software.amazon.smithy.model.shapes.FloatShape;
import software.amazon.smithy.model.shapes.IntegerShape;
import software.amazon.smithy.model.shapes.ListShape;
import software.amazon.smithy.model.shapes.LongShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ResourceShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.SetShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShortShape;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.TimestampFormatTrait.Format;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator.GenerationContext;
import software.amazon.smithy.utils.ListUtils;

public class DocumentMemberSerVisitorTest {
    private static final String DATA_SOURCE = "dataSource";
    private static final String PROTOCOL = "TestProtocol";
    private static final Format FORMAT = Format.EPOCH_SECONDS;
    private static GenerationContext mockContext;

    static {
        mockContext = new GenerationContext();
        mockContext.setProtocolName(PROTOCOL);
        mockContext.setSymbolProvider(new MockProvider());
    }

    @ParameterizedTest
    @MethodSource("validMemberTargetTypes")
    public void providesExpectedDefaults(Shape shape, String expected) {
        DocumentMemberSerVisitor visitor = new DocumentMemberSerVisitor(mockContext, DATA_SOURCE, FORMAT);
        assertThat(expected, equalTo(shape.accept(visitor)));
    }

    public static Collection<Object[]> validMemberTargetTypes() {
        String id = "com.smithy.example#Foo";
        String targetId = id + "Target";
        MemberShape member = MemberShape.builder().id(id + "$member").target(targetId).build();
        MemberShape key = MemberShape.builder().id(id + "$key").target(targetId).build();
        MemberShape value = MemberShape.builder().id(id + "$value").target(targetId).build();
        String delegate = "serialize" + ProtocolGenerator.getSanitizedName(PROTOCOL) + "Foo"
                + "(" + DATA_SOURCE + ", context)";

        return ListUtils.of(new Object[][]{
                {BooleanShape.builder().id(id).build(), DATA_SOURCE},
                {BigDecimalShape.builder().id(id).build(), DATA_SOURCE + ".toString()"},
                {BigIntegerShape.builder().id(id).build(), DATA_SOURCE + ".toString()"},
                {ByteShape.builder().id(id).build(), DATA_SOURCE},
                {DoubleShape.builder().id(id).build(), DATA_SOURCE},
                {FloatShape.builder().id(id).build(), DATA_SOURCE},
                {IntegerShape.builder().id(id).build(), DATA_SOURCE},
                {LongShape.builder().id(id).build(), DATA_SOURCE},
                {ShortShape.builder().id(id).build(), DATA_SOURCE},
                {StringShape.builder().id(id).build(), DATA_SOURCE},
                {BlobShape.builder().id(id).build(), "context.base64Encoder(" + DATA_SOURCE + ")"},
                {DocumentShape.builder().id(id).build(), delegate},
                {ListShape.builder().id(id).member(member).build(), delegate},
                {SetShape.builder().id(id).member(member).build(), delegate},
                {MapShape.builder().id(id).key(key).value(value).build(), delegate},
                {StructureShape.builder().id(id).build(), delegate},
                {UnionShape.builder().id(id).addMember(member).build(), delegate},
        });
    }

    @Test
    public void throwsOnInvalidDocumentMembers() {
        String id = "com.smithy.example#Foo";
        DocumentMemberSerVisitor visitor = new DocumentMemberSerVisitor(mockContext, DATA_SOURCE, FORMAT);

        Assertions.assertThrows(CodegenException.class, () -> {
            ServiceShape.builder().version("1").id(id).build().accept(visitor);
        });
        Assertions.assertThrows(CodegenException.class, () -> {
            OperationShape.builder().id(id).build().accept(visitor);
        });
        Assertions.assertThrows(CodegenException.class, () -> {
            ResourceShape.builder().addIdentifier("id", id + "Id").id(id).build().accept(visitor);
        });
        Assertions.assertThrows(CodegenException.class, () -> {
            MemberShape.builder().target(id + "Target").id(id + "$member").build().accept(visitor);
        });
    }

    @Test
    public void givesCorrectTimestampSerialization() {
        TimestampShape shape = TimestampShape.builder().id("com.smithy.example#Foo").build();
        DocumentMemberSerVisitor visitor = new DocumentMemberSerVisitor(mockContext, DATA_SOURCE, FORMAT);

        assertThat(DATA_SOURCE + ".toISOString()",
                equalTo(visitor.getTimestampSerializedWithFormat(shape, Format.DATE_TIME)));
        assertThat("Math.round(" + DATA_SOURCE + ".getTime() / 1000)",
                equalTo(visitor.getTimestampSerializedWithFormat(shape, Format.EPOCH_SECONDS)));
        assertThat(DATA_SOURCE + ".toUTCString()",
                equalTo(visitor.getTimestampSerializedWithFormat(shape, Format.HTTP_DATE)));
    }

    private static final class MockProvider implements SymbolProvider {
        private final String id = "com.smithy.example#Foo";
        private Symbol mock = Symbol.builder()
                .name("Foo")
                .namespace("com.smithy.example", "/")
                .build();
        private Symbol collectionMock = Symbol.builder()
                .name("Array<Foo>")
                .namespace("com.smithy.example", "/")
                .build();

        @Override
        public Symbol toSymbol(Shape shape) {
        if (shape instanceof CollectionShape) {
            MemberShape member = MemberShape.builder().id(id + "$member").target(id + "Target").build();
            return collectionMock.toBuilder().putProperty("shape",
                    ListShape.builder().id(id).member(member).build()).build();
        }
        return mock.toBuilder().putProperty("shape",
                StructureShape.builder().id(id).build()).build();
        }
    }
}
