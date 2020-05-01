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

import java.util.Set;
import java.util.function.BiConsumer;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.DocumentShape;
import software.amazon.smithy.model.shapes.ListShape;
import software.amazon.smithy.model.shapes.MapShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ResourceShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.SetShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeVisitor;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator.GenerationContext;

/**
 * Visitor to generate serialization functions for shapes in protocol document bodies.
 *
 * Visitor methods for aggregate types are final and will generate functions that dispatch
 * their body generation to the matching abstract method. The {@link DocumentMemberSerVisitor}
 * is provided to reduce the effort of this implementation by providing the default strategies
 * for serializing content from aggregate type members.
 *
 * Visitor methods for all other types will default to not generating serialization functions.
 * This may be overwritten by downstream implementations if the protocol requires more
 * complex serialization strategies for those types.
 *
 * This class reduces the effort necessary to build protocol implementations, specifically when
 * implementing {@link HttpBindingProtocolGenerator#generateDocumentBodyShapeSerializers(GenerationContext, Set)}.
 *
 * Implementations of this class independent of protocol documents are also possible.
 *
 * The standard implementation is as follows; no assumptions are made about the protocol
 * being generated for.
 *
 * <ul>
 *   <li>Service, Operation, Resource: no function generated. <b>Not overridable.</b></li>
 *   <li>Document, List, Map, Set, Structure, Union: generates a serialization function.
 *     <b>Not overridable.</b></li>
 *   <li>All other types: no function generated. <b>May be overridden.</b></li>
 * </ul>
 */
public abstract class DocumentShapeSerVisitor extends ShapeVisitor.Default<Void> {
    private final GenerationContext context;

    public DocumentShapeSerVisitor(GenerationContext context) {
        this.context = context;
    }

    /**
     * Gets the generation context.
     *
     * @return The generation context.
     */
    protected final GenerationContext getContext() {
        return context;
    }

    @Override
    protected Void getDefault(Shape shape) {
        return null;
    }

    /**
     * Writes the code needed to serialize a collection in the document of a request.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns a value representing the CollectionShape {@code shape} parameter that is
     * serializable by {@code serializeInputDocument}.
     *
     * <p>For example, given the following Smithy model:
     *
     * <pre>{@code
     * list ParameterList {
     *     member: Parameter
     * }
     * }</pre>
     *
     * <p>The function signature for this body will have two parameters available in scope:
     * <ul>
     *   <li>{@code input: Array&lt;Parameter&gt;}: the type generated for the CollectionShape shape parameter.</li>
     *   <li>{@code context: SerdeContext}: a TypeScript type containing context and tools for type serde.</li>
     * </ul>
     *
     * <p>The function signature specifies an {@code any} return type; the function body
     * should return a value serializable by {@code serializeInputDocument}.
     *
     * <p>This function would generate the following:
     *
     * <pre>{@code
     * return (input || []).map(entry =>
     *   serializeAws_restJson1_1Parameter(entry, context)
     * );
     * }</pre>
     *
     * <p>{@code Set} types will be generated appropriately for signatures when given.
     *
     * @param context The generation context.
     * @param shape The collection shape being generated.
     */
    protected abstract void serializeCollection(GenerationContext context, CollectionShape shape);

    /**
     * Writes the code needed to serialize a document in the document of a request.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns a value representing the DocumentShape {@code shape} parameter that is
     * serializable by {@code serializeInputDocument}.
     *
     * <p>For example, given the following Smithy model:
     *
     * <pre>{@code
     * document FooDocument
     * }</pre>
     *
     * <p>The function signature for this body will have two parameters available in scope:
     * <ul>
     *   <li>{@code input: FooDocument}: the type generated for the DocumentShape shape parameter.</li>
     *   <li>{@code context: SerdeContext}: a TypeScript type containing context and tools for type serde.</li>
     * </ul>
     *
     * <p>The function signature specifies an {@code any} return type; the function body
     * should return a value serializable by {@code serializeInputDocument}.
     *
     * <p>This function would generate the following:
     *
     * <pre>{@code
     * return JSON.stringify(input);
     * }</pre>
     *
     * @param context The generation context.
     * @param shape The document shape being generated.
     */
    protected abstract void serializeDocument(GenerationContext context, DocumentShape shape);

    /**
     * Writes the code needed to serialize a map in the document of a request.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns a value representing the MapShape {@code shape} parameter that is
     * serializable by {@code serializeInputDocument}.
     *
     * <p>For example, given the following Smithy model:
     *
     * <pre>{@code
     * map FieldMap {
     *     key: String,
     *     value: Field
     * }
     * }</pre>
     *
     * <p>The function signature for this body will have two parameters available in scope:
     * <ul>
     *   <li>{@code input: { [key: string]: Field }}: the type generated for the MapShape shape parameter.</li>
     *   <li>{@code context: SerdeContext}: a TypeScript type containing context and tools for type serde.</li>
     * </ul>
     *
     * <p>The function signature specifies an {@code any} return type; the function body
     * should return a value serializable by {@code serializeInputDocument}.
     *
     * <p>This function would generate the following:
     *
     * <pre>{@code
     * let mapParams: any = {};
     * Object.keys(input).forEach(key => {
     *   mapParams[key] = serializeAws_restJson1_1Field(input[key], context);
     * });
     * return mapParams;
     * }</pre>
     *
     * @param context The generation context.
     * @param shape The map shape being generated.
     */
    protected abstract void serializeMap(GenerationContext context, MapShape shape);

    /**
     * Writes the code needed to serialize a structure in the document of a request.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns a value representing the StructureShape {@code shape} parameter that is
     * serializable by {@code serializeInputDocument}.
     *
     * <p>For example, given the following Smithy model:
     *
     * <pre>{@code
     * structure Field {
     *     fooValue: Foo,
     *     barValue: String,
     * }
     * }</pre>
     *
     * <p>The function signature for this body will have two parameters available in scope:
     * <ul>
     *   <li>{@code input: Field}: the type generated for the StructureShape shape parameter.</li>
     *   <li>{@code context: SerdeContext}: a TypeScript type containing context and tools for type serde.</li>
     * </ul>
     *
     * <p>The function signature specifies an {@code any} return type; the function body
     * should return a value serializable by {@code serializeInputDocument}.
     *
     * <p>This function would generate the following:
     *
     * <pre>{@code
     * let bodyParams: any = {}
     * if (input.fooValue !== undefined) {
     *   bodyParams['fooValue'] = serializeAws_restJson1_1Foo(input.fooValue, context);
     * }
     * if (input.barValue !== undefined) {
     *   bodyParams['barValue'] = input.barValue;
     * }
     * return bodyParams;
     * }</pre>
     *
     * @param context The generation context.
     * @param shape The structure shape being generated.
     */
    protected abstract void serializeStructure(GenerationContext context, StructureShape shape);

    /**
     * Writes the code needed to serialize a union in the document of a request.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns a value representing the UnionShape {@code shape} parameter that is
     * serializable by {@code serializeInputDocument}.
     *
     * <p>For example, given the following Smithy model:
     *
     * <pre>{@code
     * union Field {
     *     fooValue: Foo,
     *     barValue: String,
     * }
     * }</pre>
     *
     * <p>The function signature for this body will have two parameters available in scope:
     * <ul>
     *   <li>{@code input: Field}: the type generated for the UnionShape shape parameter.</li>
     *   <li>{@code context: SerdeContext}: a TypeScript type containing context and tools for type serde.</li>
     * </ul>
     *
     * <p>The function signature specifies an {@code any} return type; the function body
     * should return a value serializable by {@code serializeInputDocument}.
     *
     * <p>This function would generate the following:
     *
     * <pre>{@code
     * return Field.visit(input, {
     *   fooValue: value => serializeAws_restJson1_1Foo(value, context),
     *   barValue: value => value,
     *   _: value => value
     * });
     * }</pre>
     *
     * @param context The generation context.
     * @param shape The union shape being generated.
     */
    protected abstract void serializeUnion(GenerationContext context, UnionShape shape);

    /**
     * Generates a function for serializing the input shape, dispatching the body generation
     * to the supplied function.
     *
     * @param shape The shape to generate a serializer for.
     * @param functionBody An implementation that will generate a function body to
     *                     serialize the shape.
     */
    private void generateSerFunction(
            Shape shape,
            BiConsumer<GenerationContext, Shape> functionBody
    ) {
        SymbolProvider symbolProvider = context.getSymbolProvider();
        TypeScriptWriter writer = context.getWriter();

        Symbol symbol = symbolProvider.toSymbol(shape);
        // Use the shape name for the function name.
        String methodName = ProtocolGenerator.getSerFunctionName(symbol, context.getProtocolName());

        writer.addImport(symbol, symbol.getName());
        writer.openBlock("const $L = (\n"
                       + "  input: $T,\n"
                       + "  context: __SerdeContext\n"
                       + "): any => {", "}", methodName, symbol, () -> functionBody.accept(context, shape));
        writer.write("");
    }

    @Override
    public final Void operationShape(OperationShape shape) {
        throw new CodegenException("Operation shapes cannot be bound to documents.");
    }

    @Override
    public final Void resourceShape(ResourceShape shape) {
        throw new CodegenException("Resource shapes cannot be bound to documents.");
    }

    @Override
    public final Void serviceShape(ServiceShape shape) {
        throw new CodegenException("Service shapes cannot be bound to documents.");
    }

    /**
     * Dispatches to create the body of document shape serialization functions.
     * The function signature will be generated.
     *
     * <p>For example, given the following Smithy model:
     *
     * <pre>{@code
     * document FooDocument
     * }</pre>
     *
     * <p>The following code is generated for a serializer:
     *
     * <pre>{@code
     * const serializeAws_restJson1_1FooDocument = (
     *   input: FooDocument,
     *   context: SerdeContext
     * ): any => {
     *   return JSON.stringify(input);
     * }
     * }</pre>
     *
     * @param shape The document shape to generate serialization for.
     * @return Null.
     */
    @Override
    public final Void documentShape(DocumentShape shape) {
        generateSerFunction(shape, (c, s) -> serializeDocument(c, s.asDocumentShape().get()));
        return null;
    }

    /**
     * Dispatches to create the body of list shape serialization functions.
     * The function signature will be generated.
     *
     * <p>For example, given the following Smithy model:
     *
     * <pre>{@code
     * list ParameterList {
     *     member: Parameter
     * }
     * }</pre>
     *
     * <p>The following code is generated for a serializer:
     *
     * <pre>{@code
     * const serializeAws_restJson1_1ParametersList = (
     *   input: Parameter[],
     *   context: SerdeContext
     * ): any => {
     *   return (input || []).map(entry =>
     *     serializeAws_restJson1_1Parameter(entry, context)
     *   );
     * }
     * }</pre>
     *
     * @param shape The list shape to generate serialization for.
     * @return Null.
     */
    @Override
    public final Void listShape(ListShape shape) {
        generateSerFunction(shape, (c, s) -> serializeCollection(c, s.asListShape().get()));
        return null;
    }

    /**
     * Dispatches to create the body of map shape serialization functions.
     * The function signature will be generated.
     *
     * <p>For example, given the following Smithy model:
     *
     * <pre>{@code
     * map FieldMap {
     *     key: String,
     *     value: Field
     * }
     * }</pre>
     *
     * <p>The following code is generated for a serializer:
     *
     * <pre>{@code
     * const serializeAws_restJson1_1FieldMap = (
     *   input: { [key: string]: Field },
     *   context: SerdeContext
     * ): any => {
     *   let mapParams: any = {};
     *   Object.keys(input).forEach(key => {
     *     mapParams[key] = serializeAws_restJson1_1Field(input[key], context);
     *   });
     *   return mapParams;
     * }
     * }</pre>
     *
     * @param shape The map shape to generate serialization for.
     * @return Null.
     */
    @Override
    public final Void mapShape(MapShape shape) {
        generateSerFunction(shape, (c, s) -> serializeMap(c, s.asMapShape().get()));
        return null;
    }

    /**
     * Dispatches to create the body of set shape serialization functions.
     * The function signature will be generated.
     *
     * <p>For example, given the following Smithy model:
     *
     * <pre>{@code
     * set ParameterSet {
     *     member: Parameter
     * }
     * }</pre>
     *
     * <p>The following code is generated for a serializer:
     *
     * <pre>{@code
     * const serializeAws_restJson1_1ParametersSet = (
     *   input: Set<Parameter>,
     *   context: SerdeContext
     * ): any => {
     *   return (input || []).map(entry =>
     *     serializeAws_restJson1_1Parameter(entry, context)
     *   );
     * }
     * }</pre>
     *
     * @param shape The set shape to generate serialization for.
     * @return Null.
     */
    @Override
    public final Void setShape(SetShape shape) {
        generateSerFunction(shape, (c, s) -> serializeCollection(c, s.asSetShape().get()));
        return null;
    }

    /**
     * Dispatches to create the body of structure shape serialization functions.
     * The function signature will be generated.
     *
     * <p>For example, given the following Smithy model:
     *
     * <pre>{@code
     * structure Field {
     *     fooValue: Foo,
     *     barValue: String,
     * }
     * }</pre>
     *
     * <p>The following code is generated for a serializer:
     *
     * <pre>{@code
     * const serializeAws_restJson1_1Field = (
     *   input: Field,
     *   context: SerdeContext
     * ): any => {
     *   let bodyParams: any = {}
     *   if (input.fooValue !== undefined) {
     *     bodyParams['fooValue'] = serializeAws_restJson1_1Foo(input.fooValue, context);
     *   }
     *   if (input.barValue !== undefined) {
     *     bodyParams['barValue'] = input.barValue;
     *   }
     *   return bodyParams;
     * }
     * }</pre>
     *
     * @param shape The structure shape to generate serialization for.
     * @return Null.
     */
    @Override
    public final Void structureShape(StructureShape shape) {
        generateSerFunction(shape, (c, s) -> serializeStructure(c, s.asStructureShape().get()));
        return null;
    }

    /**
     * Dispatches to create the body of union shape serialization functions.
     * The function signature will be generated.
     *
     * <p>For example, given the following Smithy model:
     *
     * <pre>{@code
     * union Field {
     *     fooValue: Foo,
     *     barValue: String,
     * }
     * }</pre>
     *
     * <p>The following code is generated for a serializer:
     *
     * <pre>{@code
     * const serializeAws_restJson1_1Field = (
     *   input: Field,
     *   context: SerdeContext
     * ): any => {
     *   return Field.visit(input, {
     *     fooValue: value => serializeAws_restJson1_1Foo(value, context),
     *     barValue: value => value,
     *     _: value => value
     *   });
     * }
     * }</pre>
     *
     * @param shape The union shape to generate serialization for.
     * @return Null.
     */
    @Override
    public final Void unionShape(UnionShape shape) {
        generateSerFunction(shape, (c, s) -> serializeUnion(c, s.asUnionShape().get()));
        return null;
    }
}
