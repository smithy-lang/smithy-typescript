package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;

import java.util.Arrays;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.shapes.IntEnumShape;
import software.amazon.smithy.model.shapes.ListShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.EnumDefinition;
import software.amazon.smithy.model.traits.EnumTrait;
import software.amazon.smithy.model.traits.MediaTypeTrait;

public class SymbolProviderTest {
    @Test
    public void createsSymbols() {
        Shape shape = StructureShape.builder().id("com.foo.baz#Hello").build();
        Model model = Model.assembler()
                .addImport(getClass().getResource("simple-service.smithy"))
                .addShape(shape)
                .assemble()
                .unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());
        SymbolProvider provider = new SymbolVisitor(model, settings);
        Symbol symbol = provider.toSymbol(shape);

        assertThat(symbol.getName(), equalTo("Hello"));
        assertThat(symbol.getNamespace(), equalTo("./" + CodegenUtils.SOURCE_FOLDER + "/models/models_0"));
        assertThat(symbol.getNamespaceDelimiter(), equalTo("/"));
        assertThat(symbol.getDefinitionFile(), equalTo("./" + CodegenUtils.SOURCE_FOLDER + "/models/models_0.ts"));
    }

    @Test
    public void createsSymbolsIntoTargetNamespace() {
        Shape shape1 = StructureShape.builder().id("com.foo#Hello").build();
        Shape shape2 = StructureShape.builder().id("com.foo.baz#Hello").build();
        Model model = Model.assembler()
                .addImport(getClass().getResource("simple-service.smithy"))
                .addShapes(shape1, shape2)
                .assemble()
                .unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());
        SymbolProvider provider = new SymbolVisitor(model, settings);
        Symbol symbol1 = provider.toSymbol(shape1);
        Symbol symbol2 = provider.toSymbol(shape2);
        MockManifest manifest = new MockManifest();
        SymbolVisitor.writeModelIndex(Arrays.asList(shape1, shape2), provider, manifest);

        assertThat(symbol1.getName(), equalTo("Hello"));
        assertThat(symbol1.getNamespace(), equalTo("./" + CodegenUtils.SOURCE_FOLDER + "/models/models_0"));
        assertThat(symbol1.getNamespaceDelimiter(), equalTo("/"));
        assertThat(symbol1.getDefinitionFile(), equalTo("./" + CodegenUtils.SOURCE_FOLDER + "/models/models_0.ts"));

        assertThat(symbol2.getName(), equalTo("Hello"));
        assertThat(symbol2.getNamespace(), equalTo("./" + CodegenUtils.SOURCE_FOLDER + "/models/models_0"));
        assertThat(symbol2.getNamespaceDelimiter(), equalTo("/"));
        assertThat(symbol2.getDefinitionFile(), equalTo("./" + CodegenUtils.SOURCE_FOLDER + "/models/models_0.ts"));
        assertThat(manifest.getFileString(CodegenUtils.SOURCE_FOLDER + "/models/index.ts").get(),
                containsString("export * from \"./models_0\";"));
    }

    @Test
    public void escapesReservedWords() {
        Shape shape = StructureShape.builder().id("com.foo.baz#Pick").build();
        Model model = Model.assembler()
                .addImport(getClass().getResource("simple-service.smithy"))
                .addShape(shape)
                .assemble()
                .unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());
        SymbolProvider provider = new SymbolVisitor(model, settings);
        Symbol symbol = provider.toSymbol(shape);

        assertThat(symbol.getName(), equalTo("_Pick"));
    }

    @Test
    public void doesNotEscapeBuiltins() {
        MemberShape member = MemberShape.builder().id("foo.bar#Object$a").target("smithy.api#String").build();
        StructureShape struct = StructureShape.builder()
                .id("foo.bar#Object")
                .addMember(member)
                .build();
        Model model = Model.assembler()
                .addImport(getClass().getResource("simple-service.smithy"))
                .addShapes(struct, member)
                .assemble()
                .unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());
        SymbolProvider provider = new SymbolVisitor(model, settings);

        Symbol structSymbol = provider.toSymbol(struct);
        Symbol memberSymbol = provider.toSymbol(member);

        // Normal structure with escaping.
        assertThat(structSymbol.getName(), equalTo("_Object"));
        assertThat(structSymbol.getNamespace(), equalTo("./" + CodegenUtils.SOURCE_FOLDER + "/models/models_0"));

        // Reference to built-in type with no escaping.
        assertThat(memberSymbol.getName(), equalTo("string"));
        assertThat(memberSymbol.getNamespace(), equalTo(""));
    }

    @Test
    public void escapesRecursiveSymbols() {
        StructureShape record = StructureShape.builder().id("foo.bar#Record").build();
        MemberShape listMember = MemberShape.builder().id("foo.bar#Records$member").target(record).build();
        ListShape list = ListShape.builder()
                .id("foo.bar#Records")
                .member(listMember)
                .build();
        Model model = Model.assembler()
                .addImport(getClass().getResource("simple-service.smithy"))
                .addShapes(list, listMember, record)
                .assemble()
                .unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());

        SymbolProvider provider = new SymbolVisitor(model, settings);
        Symbol listSymbol = provider.toSymbol(list);

        assertThat(listSymbol.getName(), equalTo("(_Record)[]"));
    }

    @Test
    public void createsCommandModules() {
        Model model = Model.assembler()
                .addImport(getClass().getResource("output-structure.smithy"))
                .assemble()
                .unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());

        Shape command = model.expectShape(ShapeId.from("smithy.example#GetFoo"));
        SymbolProvider provider = new SymbolVisitor(model, settings);
        Symbol commandSymbol = provider.toSymbol(command);

        assertThat(commandSymbol.getName(), equalTo("GetFooCommand"));
        assertThat(commandSymbol.getNamespace(),
                equalTo("./" + CodegenUtils.SOURCE_FOLDER + "/commands/GetFooCommand"));
    }

    @Test
    public void usesLazyJsonStringForJsonMediaType() {
        StringShape jsonString = StringShape.builder().id("foo.bar#jsonString")
                .addTrait(new MediaTypeTrait("application/json")).build();
        MemberShape member = MemberShape.builder().id("foo.bar#test$a").target(jsonString).build();
        StructureShape struct = StructureShape.builder()
                .id("foo.bar#test")
                .addMember(member)
                .build();
        Model model = Model.assembler()
                .addImport(getClass().getResource("simple-service.smithy"))
                .addShapes(struct, member, jsonString)
                .assemble()
                .unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());

        SymbolProvider provider = new SymbolVisitor(model, settings);
        Symbol memberSymbol = provider.toSymbol(member);

        assertThat(memberSymbol.getName(), equalTo("__LazyJsonString | string"));
    }

    @Test
    public void omitsUnknownStringEnumVariant() {
        EnumTrait trait = EnumTrait.builder()
                .addEnum(EnumDefinition.builder().value("FOO").name("FOO").build())
                .addEnum(EnumDefinition.builder().value("BAR").name("BAR").build())
                .build();
        StringShape stringShape = StringShape.builder().id("foo.bar#enumString").addTrait(trait).build();
        MemberShape member = MemberShape.builder().id("foo.bar#test$a").target(stringShape).build();
        StructureShape struct = StructureShape.builder()
                .id("foo.bar#test")
                .addMember(member)
                .build();
        Model model = Model.assembler()
                .addImport(getClass().getResource("simple-service.smithy"))
                .addShapes(struct, member, stringShape)
                .assemble()
                .unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());

        SymbolProvider provider = new SymbolVisitor(model, settings);
        Symbol memberSymbol = provider.toSymbol(member);

        assertThat(memberSymbol.getName(), equalTo("EnumString"));
    }

    @Test
    public void omitsUnknownNumberIntEnumVariant() {
        IntEnumShape shape = IntEnumShape.builder()
                .id("com.foo#Foo")
                .addMember("BAR", 2)
                .addMember("BAZ", 5)
                .build();
        MemberShape member = MemberShape.builder().id("foo.bar#test$a").target(shape).build();
        StructureShape struct = StructureShape.builder()
                .id("foo.bar#test")
                .addMember(member)
                .build();
        Model model = Model.assembler()
                .addImport(getClass().getResource("simple-service.smithy"))
                .addShapes(struct, member, shape)
                .assemble()
                .unwrap();
        TypeScriptSettings settings = TypeScriptSettings.from(model, Node.objectNodeBuilder()
                .withMember("package", Node.from("example"))
                .withMember("packageVersion", Node.from("1.0.0"))
                .build());

        SymbolProvider provider = new SymbolVisitor(model, settings);
        Symbol memberSymbol = provider.toSymbol(member);

        assertThat(memberSymbol.getName(), equalTo("Foo"));
    }

}
