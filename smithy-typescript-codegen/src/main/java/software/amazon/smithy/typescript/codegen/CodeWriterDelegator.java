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
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.BiFunction;
import software.amazon.smithy.build.FileManifest;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.utils.CodeWriter;
import software.amazon.smithy.utils.SmithyBuilder;

/**
 * Handles creating CodeWriters for filenames.
 *
 * <p>This abstraction is used to make it so that multiple shapes can generate
 * code into the same file. All CodeWriters created by this class are stored
 * in memory until a call to {@link #writeFiles()}, which causes each
 * CodeWriter to dump their contents to the provided {@code FileManifest}
 * in the mapped filename provided by the given {@code SymbolProvider}.
 *
 * @param <T> The type of CodeWriter that is vended.
 *
 * TODO: Make this public and move into core when it's stable and proven.
 */
final class CodeWriterDelegator<T extends CodeWriter> {

    private final Model model;
    private final FileManifest fileManifest;
    private final SymbolProvider symbolProvider;
    private final Map<String, T> writers = new HashMap<>();
    private final Map<String, Set<Shape>> shapesPerFile = new HashMap<>();
    private final BiFunction<Shape, Symbol, T> factory;
    private final BeforeWrite<T> beforeWrite;
    private final String addSeparator;

    CodeWriterDelegator(Builder<T> builder) {
        this.model = SmithyBuilder.requiredState("model", builder.model);
        this.fileManifest = SmithyBuilder.requiredState("fileManifest", builder.fileManifest);
        this.symbolProvider = SmithyBuilder.requiredState("symbolProvider", builder.symbolProvider);
        this.factory = SmithyBuilder.requiredState("factory", builder.factory);
        this.beforeWrite = builder.beforeWrite;
        this.addSeparator = builder.addSeparator;
    }

    public static <T extends CodeWriter> Builder<T> builder() {
        return new Builder<>();
    }

    /**
     * Gets a previously created writer or creates a new one if needed.
     *
     * <p>Any imports requires by the given symbol are automatically registered
     * with the writer. Shapes referenced by the given shape are crawled to
     * collect all contained shapes and the imports they also require.
     *
     * @param shape Shape to create the writer for.
     * @return Returns the create writer.
     */
    public T createWriter(Shape shape) {
        Symbol symbol = symbolProvider.toSymbol(shape);
        String filename = Paths.get(symbol.getDefinitionFile()).normalize().toString();

        boolean needsNewline = writers.containsKey(filename);
        T writer = writers.computeIfAbsent(filename, f -> factory.apply(shape, symbol));

        // Add newlines/separators between types in the same file.
        if (needsNewline && !addSeparator.isEmpty()) {
            writer.write(addSeparator);
        }

        shapesPerFile.computeIfAbsent(filename, f -> new HashSet<>()).add(shape);

        return writer;
    }

    public void writeFiles() {
        writers.forEach((filename, writer) -> {
            beforeWrite.apply(filename, writer, shapesPerFile.getOrDefault(filename, Collections.emptySet()));
            fileManifest.writeFile(filename, writer.toString());
        });
        writers.clear();
    }

    public interface BeforeWrite<T> {
        void apply(String filename, T writer, Set<Shape> shapes);
    }

    public static final class Builder<T extends CodeWriter> {

        private Model model;
        private FileManifest fileManifest;
        private SymbolProvider symbolProvider;
        private BiFunction<Shape, Symbol, T> factory;
        private BeforeWrite<T> beforeWrite = (filename, writer, shapes) -> { };
        private String addSeparator = "\n";

        public CodeWriterDelegator<T> build() {
            return new CodeWriterDelegator<>(this);
        }

        public Builder<T> model(Model model) {
            this.model = model;
            return this;
        }

        public Builder<T> fileManifest(FileManifest fileManifest) {
            this.fileManifest = fileManifest;
            return this;
        }

        public Builder<T> symbolProvider(SymbolProvider symbolProvider) {
            this.symbolProvider = symbolProvider;
            return this;
        }

        public Builder<T> factory(BiFunction<Shape, Symbol, T> factory) {
            this.factory = factory;
            return this;
        }

        public Builder<T> beforeWrite(BeforeWrite<T> beforeWrite) {
            this.beforeWrite = Objects.requireNonNull(beforeWrite);
            return this;
        }

        public Builder<T> addSeparator(String addSeparator) {
            this.addSeparator = Objects.requireNonNull(addSeparator);
            return this;
        }
    }
}
