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
import java.util.function.UnaryOperator;
import java.util.logging.Logger;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolContainer;
import software.amazon.smithy.codegen.core.SymbolDependency;
import software.amazon.smithy.codegen.core.SymbolDependencyContainer;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.traits.DeprecatedTrait;
import software.amazon.smithy.model.traits.DocumentationTrait;
import software.amazon.smithy.utils.CodeWriter;
import software.amazon.smithy.utils.SmithyUnstableApi;
import software.amazon.smithy.utils.StringUtils;

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
 * <p>Dependencies introduced via a TypeScriptWriter are added to the package.json
 * file if the writer is a part of the {@link TypeScriptDelegator} of the {@link CodegenVisitor}.
 */
@SmithyUnstableApi
public final class TypeScriptWriter extends CodeWriter {
    public static final String CODEGEN_INDICATOR = "// smithy-typescript generated code\n";

    private static final Logger LOGGER = Logger.getLogger(TypeScriptWriter.class.getName());

    private final Path moduleName;
    private final String moduleNameString;
    private final ImportDeclarations imports;
    private final List<SymbolDependency> dependencies = new ArrayList<>();

    public TypeScriptWriter(String moduleName) {
        this.moduleName = Paths.get(moduleName);
        moduleNameString = moduleName;
        imports = new ImportDeclarations(moduleName);

        setIndentText("  ");
        trimTrailingSpaces(true);
        trimBlankLines();
        putFormatter('T', new TypeScriptSymbolFormatter());
    }

    /**
     * Get the module name that is generated by the writer.
     *
     * @return Returns the module name.
     */
    public String getModuleName() {
        return moduleNameString;
    }

    /**
     * Imports one or more symbols if necessary, using the name of the
     * symbol and only "USE" references.
     *
     * @param container Container of symbols to add.
     * @return Returns the writer.
     */
    public TypeScriptWriter addUseImports(SymbolContainer container) {
        for (Symbol symbol : container.getSymbols()) {
            addImport(symbol, symbol.getName(), SymbolReference.ContextOption.USE);
        }
        return this;
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
     * default import using an alias from a module only if necessary.
     *
     * @param name Name of default import.
     * @param from Module to default import from.
     * @return Returns the writer.
     */
    public TypeScriptWriter addDefaultImport(String name, String from) {
        imports.addDefaultImport(name, from);
        return this;
    }

    /**
     * default import from a module, annotated with @ts-ignore.
     *
     * @param name Name of default import.
     * @param from Module to default import from.
     * @param reason The reason for ignoring the import
     * @return Returns the writer.
     */
    public TypeScriptWriter addIgnoredDefaultImport(String name, String from, String reason) {
        imports.addIgnoredDefaultImport(name, from, reason);
        return this;
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
     * <p>This function escapes "$" characters so formatters are not run.
     *
     * @param docs Documentation to write.
     * @return Returns the writer.
     */
    public TypeScriptWriter writeDocs(String docs) {
        // Docs can have valid $ characters that shouldn't run through formatters.
        // Escapes multi-line comment closings.
        writeDocs(() -> write(docs.replace("$", "$$").replace("*/", "*\\/")));
        return this;
    }

    /**
     * Modifies and writes shape documentation comments if docs are present.
     *
     * @param shape Shape to write the documentation of.
     * @param preprocessor UnaryOperator that takes documentation and returns modified one.
     * @return Returns true if docs were written.
     */
    boolean writeShapeDocs(Shape shape, UnaryOperator<String> preprocessor) {
        return shape.getTrait(DocumentationTrait.class)
                .map(DocumentationTrait::getValue)
                .map(docs -> {
                    docs = preprocessor.apply(docs);
                    if (shape.getTrait(DeprecatedTrait.class).isPresent()) {
                        docs = "@deprecated\n\n" + docs;
                    }
                    writeDocs(docs);
                    return true;
                }).orElse(false);
    }

    /**
     * Writes shape documentation comments if docs are present.
     *
     * @param shape Shape to write the documentation of.
     * @return Returns true if docs were written.
     */
    boolean writeShapeDocs(Shape shape) {
        return writeShapeDocs(shape, (docs) -> docs);
    }

    /**
     * Writes member shape documentation comments if docs are present.
     *
     * @param model Model used to dereference targets.
     * @param member Shape to write the documentation of.
     * @return Returns true if docs were written.
     */
    boolean writeMemberDocs(Model model, MemberShape member) {
        return member.getMemberTrait(model, DocumentationTrait.class)
                .map(DocumentationTrait::getValue)
                .map(docs -> {
                    if (member.getMemberTrait(model, DeprecatedTrait.class).isPresent()) {
                        docs = "@deprecated\n\n" + docs;
                    }
                    writeDocs(docs);
                    return true;
                }).orElse(false);
    }

    /**
     * Adds one or more dependencies to the generated code.
     *
     * <p>The dependencies of all writers created by the {@link TypeScriptDelegator}
     * are merged together to eventually generate a package.json file.
     *
     * @param dependencies TypeScriptDependency to add.
     * @return Returns the writer.
     */
    public TypeScriptWriter addDependency(SymbolDependencyContainer dependencies) {
        this.dependencies.addAll(dependencies.getDependencies());
        return this;
    }

    Collection<SymbolDependency> getDependencies() {
        return dependencies;
    }

    @Override
    public String toString() {
        String contents = super.toString();
        String importString = imports.toString();
        String strippedContents = StringUtils.stripStart(contents, null);
        String strippedImportString = StringUtils.strip(importString, null);

        // Don't add an additional new line between explicit imports and managed imports.
        if (!strippedImportString.isEmpty() && strippedContents.startsWith("import ")) {
            return CODEGEN_INDICATOR + strippedImportString + "\n" + strippedContents;
        }

        return CODEGEN_INDICATOR + importString + contents;
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
                        "Invalid type provided to $T. Expected a Symbol or SymbolReference, but found `" + type + "`");
            }
        }
    }
}
