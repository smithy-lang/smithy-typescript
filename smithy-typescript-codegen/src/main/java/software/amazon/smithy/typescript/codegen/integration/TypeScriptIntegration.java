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

package software.amazon.smithy.typescript.codegen.integration;

import java.util.Collections;
import java.util.List;
import software.amazon.smithy.build.PluginContext;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;

/**
 * Java SPI for customizing TypeScript code generation, registering
 * new protocol code generators, renaming shapes, modifying the model,
 * adding custom code, etc.
 */
public interface TypeScriptIntegration {
    /**
     * Preprocess the model before code generation.
     *
     * <p>This can be used to remove unsupported features, remove traits
     * from shapes (e.g., make members optional), etc.
     *
     * @param context Plugin context.
     * @param settings Setting used to generate.
     * @return Returns the updated model.
     */
    default Model preprocessModel(PluginContext context, TypeScriptSettings settings) {
        return context.getModel();
    }

    /**
     * Updates the {@link SymbolProvider} used when generating code.
     *
     * <p>This can be used to customize the names of shapes, the package
     * that code is generated into, add dependencies, add imports, etc.
     *
     * @param context Plugin context.
     * @param settings Setting used to generate.
     * @param symbolProvider The original {@code SymbolProvider}.
     * @return The decorated {@code SymbolProvider}.
     */
    default SymbolProvider decorateSymbolProvider(
            PluginContext context,
            TypeScriptSettings settings,
            SymbolProvider symbolProvider
    ) {
        return symbolProvider;
    }

    /**
     * Called exactly once when a writer is first created.
     *
     * <p>Unlike {@link #onShapeWriterUse}, any changes made to the writer
     * in this callback (for example, adding section interceptors) stay with
     * the writer even after this callback has completed.
     *
     * @param settings Settings used to generate.
     * @param model Model to generate from.
     * @param symbolProvider Symbol provider used to generate code.
     * @param writer Writer that was created.
     */
    default void onWriterCreated(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            TypeScriptWriter writer
    ) {
        // pass
    }

    /**
     * Called each time a writer is used that defines a shape.
     *
     * <p>This method could be called multiple times for the same writer
     * but for different shapes. It gives an opportunity to intercept code
     * sections of a {@link TypeScriptWriter} by name using the shape for
     * context. For example:
     *
     * <pre>
     * {@code
     * TypeScriptIntegration customization = new TypeScriptIntegration() {
     *     public onWriterUse(TypeScriptSettings settings, Model model, SymbolProvider symbolProvider,
     *             TypeScriptWriter writer, Shape definedShape) {
     *         writer.onSection("example", text -&gt; writer.write("Intercepted: " + text"));
     *     }
     * };
     * }</pre>
     *
     * <p>Any mutations made on the writer (for example, adding
     * section interceptors) are removed after the callback has completed;
     * the callback is invoked in between pushing and popping state from
     * the writer.
     *
     * @param settings Settings used to generate.
     * @param model Model to generate from.
     * @param symbolProvider Symbol provider used for codegen.
     * @param writer Writer that will be used.
     * @param definedShape Shape that is being defined in the writer.
     */
    default void onShapeWriterUse(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            TypeScriptWriter writer,
            Shape definedShape
    ) {
        // pass
    }

    /**
     * Gets a list of plugins to apply to the generated client.
     *
     * @return Returns the list of RuntimePlugins to apply to the client.
     */
    default List<RuntimeClientPlugin> getClientPlugins() {
        return Collections.emptyList();
    }

    /**
     * Gets a list of protocol generators to register.
     *
     * @return Returns the list of protocol generators to register.
     */
    default List<ProtocolGenerator> getProtocolGenerators() {
        return Collections.emptyList();
    }
}
