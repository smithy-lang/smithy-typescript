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

import java.nio.file.Paths;
import java.util.function.BiFunction;
import java.util.function.UnaryOperator;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.codegen.core.SymbolWriter;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.traits.DeprecatedTrait;
import software.amazon.smithy.model.traits.DocumentationTrait;
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
public final class TypeScriptWriter extends SymbolWriter<TypeScriptWriter, ImportDeclarations> {
    public static final String CODEGEN_INDICATOR = "// smithy-typescript generated code\n";

    private final boolean withAttribution;

    public TypeScriptWriter(String moduleName) {
        this(moduleName, false);
    }

    private TypeScriptWriter(String moduleName, boolean withAttribution) {
        super(new ImportDeclarations(moduleName));

        setIndentText("  ");
        trimTrailingSpaces(true);
        trimBlankLines();
        putFormatter('T', new TypeScriptSymbolFormatter());

        this.withAttribution = withAttribution;
    }

    public static final class TypeScriptWriterFactory implements SymbolWriter.Factory<TypeScriptWriter> {

        @Override
        public TypeScriptWriter apply(String filename, String namespace) {
            if (!filename.startsWith(Paths.get(CodegenUtils.SOURCE_FOLDER).normalize().toString())) {
                filename = Paths.get(CodegenUtils.SOURCE_FOLDER, filename).toString();
            }
            boolean attribution = filename.endsWith(".ts") || filename.endsWith(".tsx");
            // TODO: Attribution accounts for tsx too, but moduleName doesn't.
            String moduleName = filename.endsWith(".ts") ? filename.substring(0, filename.length() - 3) : filename;
            return new TypeScriptWriter(moduleName, attribution);
        }
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
        getImportContainer().addIgnoredDefaultImport(name, from, reason);
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
    // TODO: see what references of this method call can be changed to use Symbol instead of String name
    public TypeScriptWriter addImport(String name, String as, String from) {
        getImportContainer().addImport(name, as, from);
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

    @Override
    public String toString() {
        String contents = super.toString();
        String importString = getImportContainer().toString();
        String strippedContents = StringUtils.stripStart(contents, null);
        String strippedImportString = StringUtils.strip(importString, null);
        String attribution = withAttribution ? CODEGEN_INDICATOR : "";

        // Don't add an additional new line between explicit imports and managed imports.
        if (!strippedImportString.isEmpty() && strippedContents.startsWith("import ")) {
            return attribution + strippedImportString + "\n" + strippedContents;
        }

        return attribution + importString + contents;
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
