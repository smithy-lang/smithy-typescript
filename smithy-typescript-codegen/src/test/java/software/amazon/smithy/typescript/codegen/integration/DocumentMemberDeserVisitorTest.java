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
import software.amazon.smithy.model.Model;
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
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.ShortShape;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.MediaTypeTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait.Format;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings.ArtifactType;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator.GenerationContext;
import software.amazon.smithy.utils.ListUtils;

public class DocumentMemberDeserVisitorTest {
    private static final String DATA_SOURCE = "dataSource";
    private static final String PROTOCOL = "TestProtocol";
    private static final Format FORMAT = Format.EPOCH_SECONDS;
    private static GenerationContext mockContext;
    private static TypeScriptSettings mockSettings;
    private static StringShape target = StringShape.builder().id(ShapeId.from("com.smithy.example#FooTarget")).build();

    static {
        mockContext = new GenerationContext();
        mockSettings = new TypeScriptSettings();
        mockContext.setProtocolName(PROTOCOL);
        mockContext.setSymbolProvider(new MockProvider());
        mockContext.setWriter(new TypeScriptWriter("foo"));
        mockSettings.setArtifactType(ArtifactType.SSDK);
        mockContext.setSettings(mockSettings);
    }

    @ParameterizedTest
    @MethodSource("validMemberTargetTypes")
    public void providesExpectedDefaults(Shape shape, String expected, MemberShape memberShape) {
        Shape fakeStruct = StructureShape.builder().id("com.smithy.example#Enclosing").addMember(memberShape).build();
        mockContext.setModel(Model.builder().addShapes(shape, fakeStruct, target).build());
        DocumentMemberDeserVisitor visitor =
                new DocumentMemberDeserVisitor(mockContext, DATA_SOURCE, FORMAT) {
                    @Override
                    protected MemberShape getMemberShape() {
                        return memberShape;
                    }
                };
        assertThat(shape.accept(visitor), equalTo(expected));
    }

    public static Collection<Object[]> validMemberTargetTypes() {
        String id = "com.smithy.example#Foo";
        String targetId = String.valueOf(target.getId());
        MemberShape source = MemberShape.builder().id("com.smithy.example#Enclosing$sourceMember").target(id).build();
        MemberShape member = MemberShape.builder().id(id + "$member").target(targetId).build();
        MemberShape key = MemberShape.builder().id(id + "$key").target(targetId).build();
        MemberShape value = MemberShape.builder().id(id + "$value").target(targetId).build();
        String delegate = "de_Foo"
                + "(" + DATA_SOURCE + ", context)";

        return ListUtils.of(new Object[][]{
                {BooleanShape.builder().id(id).build(), "__expectBoolean(" + DATA_SOURCE + ")", source},
                {ByteShape.builder().id(id).build(), "__expectByte(" + DATA_SOURCE + ")", source},
                {DoubleShape.builder().id(id).build(), "__limitedParseDouble(" + DATA_SOURCE + ")", source},
                {FloatShape.builder().id(id).build(), "__limitedParseFloat32(" + DATA_SOURCE + ")", source},
                {IntegerShape.builder().id(id).build(), "__expectInt32(" + DATA_SOURCE + ")", source},
                {LongShape.builder().id(id).build(), "__expectLong(" + DATA_SOURCE + ")", source},
                {ShortShape.builder().id(id).build(), "__expectShort(" + DATA_SOURCE + ")", source},
                {StringShape.builder().id(id).build(), "__expectString(" + DATA_SOURCE + ")", source},
                {
                    StringShape.builder().id(id).addTrait(new MediaTypeTrait("foo+json")).build(),
                    "__LazyJsonString.from(" + DATA_SOURCE + ")",
                    source
                },
                {BlobShape.builder().id(id).build(), "context.base64Decoder(" + DATA_SOURCE + ")", source},
                {DocumentShape.builder().id(id).build(), delegate, source},
                {ListShape.builder().id(id).member(member).build(), delegate, source},
                {SetShape.builder().id(id).member(member).build(), delegate, source},
                {MapShape.builder().id(id).key(key).value(value).build(), delegate, source},
                {StructureShape.builder().id(id).build(), delegate, source},
                {
                    TimestampShape.builder().id(id).build(),
                    "__expectNonNull(__parseEpochTimestamp(" + DATA_SOURCE + "))",
                    source
                },
                {
                    TimestampShape.builder().id(id).build(),
                    "__expectNonNull(__parseRfc3339DateTime(" + DATA_SOURCE + "))",
                    source.toBuilder().addTrait(new TimestampFormatTrait(TimestampFormatTrait.DATE_TIME)).build()
                },
                {
                    TimestampShape.builder().id(id).build(),
                    "__expectNonNull(__parseRfc7231DateTime(" + DATA_SOURCE + "))",
                    source.toBuilder().addTrait(new TimestampFormatTrait(TimestampFormatTrait.HTTP_DATE)).build()
                },
                {
                    UnionShape.builder().id(id).addMember(member).build(),
                    "de_Foo(__expectUnion(" + DATA_SOURCE + "), context)",
                    source
                },
        });
    }

    @Test
    public void throwsOnInvalidDocumentMembers() {
        String id = "com.smithy.example#Foo";
        DocumentMemberDeserVisitor visitor = new DocumentMemberDeserVisitor(mockContext, DATA_SOURCE, FORMAT);

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

    private static final class MockProvider implements SymbolProvider {
        private final String id = "com.smithy.example#Foo";
        private Symbol mock = Symbol.builder()
                .name("Foo")
                .namespace("com.smithy.example", "/")
                .build();
        private Symbol collectionMock = Symbol.builder()
                .name("Foo[]")
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
