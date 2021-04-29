/*
 * Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

import java.util.logging.Logger;
import software.amazon.smithy.codegen.core.ReservedWordSymbolProvider;
import software.amazon.smithy.codegen.core.ReservedWords;
import software.amazon.smithy.codegen.core.ReservedWordsBuilder;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeType;
import software.amazon.smithy.model.shapes.ShapeVisitor;
import software.amazon.smithy.model.shapes.ToShapeId;
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.utils.StringUtils;

/**
 * Wraps a client SymbolProvider and generates substitute shapes for server-specific symbols.
 */
@SmithyInternalApi
final class ServerSymbolVisitor extends ShapeVisitor.Default<Symbol> implements SymbolProvider {
    private static final Logger LOGGER = Logger.getLogger(ServerSymbolVisitor.class.getName());

    private final Model model;
    private final SymbolProvider delegate;
    private final ReservedWordSymbolProvider.Escaper escaper;
    private final ModuleNameDelegator moduleNameDelegator;

    ServerSymbolVisitor(Model model, SymbolProvider delegate) {
        this.model = model;
        this.delegate = delegate;

        // Load reserved words from a new-line delimited file.
        ReservedWords reservedWords = new ReservedWordsBuilder()
                .loadWords(TypeScriptCodegenPlugin.class.getResource("reserved-words.txt"))
                .build();

        escaper = ReservedWordSymbolProvider.builder()
                .nameReservedWords(reservedWords)
                // Only escape words when the symbol has a definition file to
                // prevent escaping intentional references to built-in types.
                .escapePredicate((shape, symbol) -> !StringUtils.isEmpty(symbol.getDefinitionFile()))
                .buildEscaper();

        moduleNameDelegator = new ModuleNameDelegator();
    }

    @Override
    public Symbol toSymbol(Shape shape) {
        if (shape.getType() == ShapeType.SERVICE
            || shape.getType() == ShapeType.OPERATION) {
            Symbol symbol = shape.accept(this);
            LOGGER.fine(() -> "Creating symbol from " + shape + ": " + symbol);
            return escaper.escapeSymbol(shape, symbol);
        }
        return delegate.toSymbol(shape);
    }

    @Override
    public Symbol operationShape(OperationShape shape) {
        String shapeName = flattenShapeName(shape);
        String moduleName = moduleNameDelegator.formatModuleName(shape, shapeName);

        Symbol intermediate = createGeneratedSymbolBuilder(shape, shapeName, moduleName).build();
        Symbol.Builder builder = intermediate.toBuilder();
        //TODO: these names suck but otherwise they clash with the names in models
        builder.putProperty("inputType", intermediate.toBuilder().name(shapeName + "ServerInput").build());
        builder.putProperty("outputType", intermediate.toBuilder().name(shapeName + "ServerOutput").build());
        builder.putProperty("errorsType", intermediate.toBuilder().name(shapeName + "Errors").build());
        builder.putProperty("serializerType", intermediate.toBuilder().name(shapeName + "Serializer").build());
        builder.putProperty("handler",
                intermediate.toBuilder().name(shapeName + "Handler").build());
        return builder.build();
    }

    @Override
    public Symbol serviceShape(ServiceShape shape) {
        String baseName = flattenShapeName(shape);
        String serviceName = baseName + "Service";
        String moduleName = moduleNameDelegator.formatModuleName(shape, serviceName);

        Symbol intermediate = createGeneratedSymbolBuilder(shape, serviceName, moduleName).build();
        Symbol.Builder builder = intermediate.toBuilder();
        builder.putProperty("operations",
                intermediate.toBuilder().name(serviceName + "Operations").build());
        builder.putProperty("handler",
                intermediate.toBuilder().name(serviceName + "Handler").build());
        return builder.build();
    }

    @Override
    protected Symbol getDefault(Shape shape) {
        return delegate.toSymbol(shape);
    }

    // TODO: Can probably share these statically with SymbolVisitor
    private String flattenShapeName(ToShapeId id) {
        return StringUtils.capitalize(id.toShapeId().getName());
    }

    private Symbol.Builder createGeneratedSymbolBuilder(Shape shape, String typeName, String namespace) {
        return createSymbolBuilder(shape, typeName, namespace)
                .definitionFile(toFilename(namespace));
    }

    private Symbol.Builder createSymbolBuilder(Shape shape, String typeName, String namespace) {
        return Symbol.builder()
                .putProperty("shape", shape)
                .name(typeName)
                .namespace(namespace, "/");
    }

    private String toFilename(String namespace) {
        return namespace + ".ts";
    }

    static final class ModuleNameDelegator {

        public String formatModuleName(Shape shape, String name) {
            if (shape.getType() == ShapeType.SERVICE) {
                return "./server/" + name;
            } else if (shape.getType() == ShapeType.OPERATION) {
                return "./server/operations/" + name;
            }

            throw new IllegalArgumentException("Unsupported shape type: " + shape.getType());
        }
    }
}
