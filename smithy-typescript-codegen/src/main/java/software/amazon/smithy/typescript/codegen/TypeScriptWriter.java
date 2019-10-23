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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.StringJoiner;
import java.util.function.BiFunction;
import java.util.logging.Logger;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.Model;
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
 */
public final class TypeScriptWriter extends CodeWriter {

    private static final Logger LOGGER = Logger.getLogger(TypeScriptWriter.class.getName());

    private final Path moduleName;
    private final String moduleNameString;
    private final ImportDeclarations imports;
    private final List<SymbolDependency> dependencies = new ArrayList<>();

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
        return CodeWriterDelegator.<TypeScriptWriter>builder()
                .model(model)
                .symbolProvider(symbolProvider)
                .fileManifest(fileManifest)
                .factory((shape, symbol) -> new TypeScriptWriter(symbol.getNamespace()))
                .beforeWrite((filename, writer, shapes) -> {
                    // Add imports necessary for DECLARE statements.
                    for (Shape shape : shapes) {
                        Symbol symbol = symbolProvider.toSymbol(shape);
                        writer.addImportReferences(symbol, SymbolReference.ContextOption.DECLARE);
                        symbol.getDependencies().forEach(writer::addDependency);
                    }
                })
                .build();
    }

    /**
     * Imports a symbol if necessary, using the name of the symbol
     * and only "USE" references.
     *
     * @param symbol Symbol to import.
     * @return Returns the writer.
     */
    public TypeScriptWriter addUseImports(Symbol symbol) {
        return addImport(symbol, symbol.getName(), SymbolReference.ContextOption.USE);
    }

    /**
     * Imports a symbol reference if necessary, using the alias of the
     * reference and only associated "USE" references.
     *
     * @param symbolReference Symbol reference to import.
     * @return Returns the writer.
     */
    public TypeScriptWriter addUseImports(SymbolReference symbolReference) {
        return addImport(symbolReference.getSymbol(), symbolReference.getAlias(), SymbolReference.ContextOption.USE);
    }

    /**
     * Imports a symbol if necessary using an alias and list of context options.
     *
     * @param symbol Symbol to optionally import.
     * @param alias The alias to refer to the symbol by.
     * @param options The list of context options (e.g., is it a USE or DECLARE symbol).
     * @return Returns the writer.
     */
    public TypeScriptWriter addImport(Symbol symbol, String alias, SymbolReference.ContextOption... options) {
        LOGGER.finest(() -> {
            StringJoiner stackTrace = new StringJoiner("\n");
            for (StackTraceElement element : Thread.currentThread().getStackTrace()) {
                stackTrace.add(element.toString());
            }
            return String.format(
                    "Adding TypeScript import %s as `%s` (%s); Stack trace: %s",
                    symbol, alias, Arrays.toString(options), stackTrace);
        });

        // Always add dependencies.
        dependencies.addAll(symbol.getDependencies());

        if (!symbol.getNamespace().isEmpty() && !symbol.getNamespace().equals(moduleNameString)) {
            addImport(symbol.getName(), alias, symbol.getNamespace());
        }

        // Just because the direct symbol wasn't imported doesn't mean that the
        // symbols it needs to be declared don't need to be imported.
        addImportReferences(symbol, options);

        return this;
    }

    void addImportReferences(Symbol symbol, SymbolReference.ContextOption... options) {
        for (SymbolReference reference : symbol.getReferences()) {
            for (SymbolReference.ContextOption option : options) {
                if (reference.hasOption(option)) {
                    addImport(reference.getSymbol(), reference.getAlias(), options);
                    break;
                }
            }
        }
    }

    /**
     * Imports a type using an alias from a module only if necessary.
     *
     * @param name Type to import.
     * @param as Alias to refer to the type as.
     * @param from Module to import the type from.
     * @return Returns the writer.
     */
    public TypeScriptWriter addImport(String name, String as, String from) {
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
     * Writes documentation comments from a string.
     *
     * @param docs Documentation to write.
     * @return Returns the writer.
     */
    public TypeScriptWriter writeDocs(String docs) {
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

    /**
     * Adds a dependency to the generated code.
     *
     * <p>The dependencies of all writers are merged together to eventually generate
     * a package.json file.
     *
     * @param dependency Dependency to add.
     * @return Returns the writer.
     */
    public TypeScriptWriter addDependency(SymbolDependency dependency) {
        dependencies.add(dependency);
        return this;
    }

    Collection<SymbolDependency> getDependencies() {
        return dependencies;
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
            if (type instanceof Symbol) {
                Symbol typeSymbol = (Symbol) type;
                addUseImports(typeSymbol);
                return typeSymbol.getName();
            } else if (type instanceof SymbolReference) {
                SymbolReference typeSymbol = (SymbolReference) type;
                addImport(typeSymbol.getSymbol(), typeSymbol.getAlias(), SymbolReference.ContextOption.USE);
                return typeSymbol.getAlias();
            } else {
                throw new CodegenException(
                        "Invalid type provided to $T. Expected a Symbol or SymbolReference, but found " + type);
            }
        }
    }
}
