package software.amazon.smithy.typescript.codegen;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.equalTo;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.build.MockManifest;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.utils.SetUtils;
import software.amazon.smithy.utils.Triple;

public class CodeWriterDelegatorTest {
    @Test
    public void vendsWritersForShapes() {
        Model model = createModel();
        Shape fooShape = model.getShapeIndex().getShape(ShapeId.from("smithy.example#Foo")).get();
        SymbolProvider provider = createProvider();
        MockManifest manifest = new MockManifest();
        CodeWriterDelegator<TypeScriptWriter> delegator = createBuilder(model, provider, manifest).build();

        TypeScriptWriter writer = delegator.createWriter(fooShape);
        writer.write("Hello!");
        delegator.writeFiles();

        assertThat(manifest.getFileString("Foo.txt").get(), equalTo("Hello!\n"));
    }

    @Test
    public void appendsToOpenedWriterWithCustomSeparator() {
        Model model = createModel();
        Shape fooShape = model.getShapeIndex().getShape(ShapeId.from("smithy.example#Foo")).get();
        SymbolProvider provider = createProvider();
        MockManifest manifest = new MockManifest();
        CodeWriterDelegator<TypeScriptWriter> delegator = createBuilder(model, provider, manifest)
                .addSeparator("\n// yap")
                .build();

        delegator.createWriter(fooShape).write("Hello!");
        delegator.createWriter(fooShape).write("Goodbye!");
        delegator.writeFiles();

        assertThat(manifest.getFileString("Foo.txt").get(), equalTo("Hello!\n\n// yap\nGoodbye!\n"));
    }

    @Test
    public void emitsBeforeWriting() {
        Model model = createModel();
        Shape fooShape = model.getShapeIndex().getShape(ShapeId.from("smithy.example#Foo")).get();
        SymbolProvider provider = createProvider();
        MockManifest manifest = new MockManifest();
        List<Triple<String, TypeScriptWriter, Set<Shape>>> before = new ArrayList<>();
        CodeWriterDelegator<TypeScriptWriter> delegator = createBuilder(model, provider, manifest)
                .beforeWrite((filename, writer, shapes) -> {
                    before.add(Triple.of(filename, writer, shapes));
                })
                .build();

        TypeScriptWriter vended = delegator.createWriter(fooShape);
        vended.write("Hello!");
        delegator.writeFiles();

        assertThat(before, containsInAnyOrder(Triple.of("Foo.txt", vended, SetUtils.of(fooShape))));
    }

    private static CodeWriterDelegator.Builder<TypeScriptWriter> createBuilder(
            Model model,
            SymbolProvider provider,
            FileManifest manifest
    ) {
        return CodeWriterDelegator.<TypeScriptWriter>builder()
                .model(model)
                .symbolProvider(provider)
                .fileManifest(manifest)
                .factory((shape, symbol) -> new TypeScriptWriter(symbol.getNamespace()));
    }

    private static Model createModel() {
        return Model.assembler()
                .addImport(CodeWriterDelegatorTest.class.getResource("testmodel.smithy"))
                .assemble()
                .unwrap();
    }

    private static SymbolProvider createProvider() {
        return shape -> Symbol.builder()
                .name(shape.getId().getName())
                .namespace(shape.getId().getNamespace(), "/")
                .definitionFile(shape.getId().getName() + ".txt")
                .build();
    }
}
