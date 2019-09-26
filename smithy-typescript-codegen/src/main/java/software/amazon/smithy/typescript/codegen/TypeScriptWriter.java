/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

package software.amazon.smithy.typescript.codegen;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.function.BiFunction;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.NeighborProviderIndex;
import software.amazon.smithy.model.neighbor.Walker;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.traits.DocumentationTrait;
import software.amazon.smithy.utils.CodeWriter;

/**
 * Specialized code writer for managing TypeScript dependencies.
 *
 * <p>Use the {@code $T} formatter to refer to {@link Symbol}s. These symbols
 * are automatically imported into the writer and relativized if necessary.
 *
 * <p>When adding imports, start the module name with "./" to resolve relative
 * module paths against the moduleName of the writer. Module names that
 * start with anything other than "." (e.g., "@", "/", etc.) are never
 * relativized.
 *
 * TODO: Make this public when it's stable.
 */
final class TypeScriptWriter extends CodeWriter {

    private final Path moduleName;
    private final String moduleNameString;
    private final ImportDeclarations imports;

    TypeScriptWriter(String moduleName) {
        this.moduleName = Paths.get(moduleName);
        moduleNameString = moduleName;
        imports = new ImportDeclarations(moduleName);

        setIndentText("  ");
        trimTrailingSpaces(true);
        trimBlankLines();
        putFormatter('T', new TypeScriptSymbolFormatter());
    }

    /**
     * Handles delegating out access to {@code TypeScriptWriter}s based on
     * the resolved filename of a symbol.
     *
     * @param model Model that contains all shapes being generated.
     * @param symbolProvider Symbol provider that converts shapes to symbols.
     * @param fileManifest The manifest of where files are written.
     * @return Returns the created delegator.
     */
    static CodeWriterDelegator<TypeScriptWriter> createDelegator(
            Model model,
            SymbolProvider symbolProvider,
            FileManifest fileManifest
    ) {
        Walker walker = new Walker(model.getKnowledge(NeighborProviderIndex.class).getProvider());

        return CodeWriterDelegator.<TypeScriptWriter>builder()
                .model(model)
                .symbolProvider(symbolProvider)
                .fileManifest(fileManifest)
                .factory((shape, symbol) -> new TypeScriptWriter(symbol.getNamespace()))
                .beforeWrite((filename, writer, shapes) -> {
                    // Add dependencies of the shape and any references it has by
                    // walking the shape's neighbors.
                    for (Shape shape : shapes) {
                        writer.addImport(symbolProvider.toSymbol(shape));
                        walker.walkShapes(shape).forEach(neighbor -> {
                            writer.addImport(symbolProvider.toSymbol(neighbor));
                        });
                    }
                })
                .build();
    }

    /**
     * Imports a symbol if necessary.
     *
     * @param symbol Symbol to import.
     * @return Returns the writer.
     */
    TypeScriptWriter addImport(Symbol symbol) {
        if (!symbol.getNamespace().isEmpty()) {
            if (!symbol.getNamespace().equals(moduleNameString)) {
                addImport(symbol.getName(), symbol.getName(), symbol.getNamespace());
            }
            for (SymbolReference reference : symbol.getReferences()) {
                addImport(reference);
            }
        }

        return this;
    }

    /**
     * Imports a symbol reference.
     *
     * @param reference Symbol reference to import.
     * @return Returns the writer.
     */
    TypeScriptWriter addImport(SymbolReference reference) {
        // If there's no alias, then just import the symbol normally.
        if (reference.getAlias().equals(reference.getSymbol().getName())) {
            return addImport(reference.getSymbol());
        }

        // Symbols with references are always imported since they don't
        // conflict and must be imported in order for the code to work.
        return addImport(reference.getSymbol().getName(), reference.getAlias(), reference.getSymbol().getNamespace());
    }

    /**
     * Imports a type using an alias from a module only if necessary.
     *
     * @param name Type to import.
     * @param as Alias to refer to the type as.
     * @param from Module to import the type from.
     * @return Returns the writer.
     */
    TypeScriptWriter addImport(String name, String as, String from) {
        imports.addImport(name, as, from);
        return this;
    }

    /**
     * Writes documentation comments.
     *
     * @param runnable Runnable that handles actually writing docs with the writer.
     * @return Returns the writer.
     */
    TypeScriptWriter writeDocs(Runnable runnable) {
        pushState("docs");
        write("/**");
        setNewlinePrefix(" * ");
        runnable.run();
        setNewlinePrefix("");
        write(" */");
        popState();
        return this;
    }

    /**
     * Writes documentation comments.
     *
     * @param docs Documentation to write.
     * @return Returns the writer.
     */
    TypeScriptWriter writeDocs(String docs) {
        writeDocs(() -> write(docs));
        return this;
    }

    /**
     * Writes shape documentation comments if docs are present.
     *
     * @param shape Shape to write the documentation of.
     * @return Returns true if docs were written.
     */
    boolean writeShapeDocs(Shape shape) {
        return shape.getTrait(DocumentationTrait.class)
                .map(DocumentationTrait::getValue)
                .map(docs -> {
                    writeDocs(docs);
                    return true;
                }).orElse(false);
    }

    /**
     * Writes member shape documentation comments if docs are present.
     *
     * @param model Model used to dereference targets.
     * @param member Shape to write the documentation of.
     * @return Returns true if docs were written.
     */
    boolean writeMemberDocs(Model model, MemberShape member) {
        return member.getMemberTrait(model.getShapeIndex(), DocumentationTrait.class)
                .map(DocumentationTrait::getValue)
                .map(docs -> {
                    writeDocs(docs);
                    return true;
                }).orElse(false);
    }

    @Override
    public String toString() {
        return imports.toString() + super.toString();
    }

    /**
     * Adds TypeScript symbols for the "$T" formatter.
     */
    private final class TypeScriptSymbolFormatter implements BiFunction<Object, String, String> {
        @Override
        public String apply(Object type, String indent) {
            if (!(type instanceof Symbol)) {
                throw new CodegenException("Invalid type provided to $T. Expected a Symbol: " + type);
            }

            Symbol typeSymbol = (Symbol) type;
            addImport(typeSymbol);

            for (SymbolReference reference : typeSymbol.getReferences()) {
                if (reference.hasOption(SymbolReference.ContextOption.USE)) {
                    addImport(reference);
                }
            }

            return typeSymbol.getName();
        }
    }
}
