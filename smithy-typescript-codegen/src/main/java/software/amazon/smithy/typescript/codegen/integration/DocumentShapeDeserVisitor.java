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
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Visitor to generate deserialization functions for shapes in protocol document bodies.
 *
 * Visitor methods for aggregate types are final and will generate functions that dispatch
 * their loading from the body to the matching abstract method. The {@link DocumentMemberDeserVisitor}
 * is provided to reduce the effort of this implementation by providing the default strategies
 * for deserializing content from aggregate type members.
 *
 * Visitor methods for all other types will default to not generating deserialization
 * functions. This may be overwritten by downstream implementations if the protocol requires
 * more complex deserialization strategies for those types.
 *
 * This class reduces the effort necessary to build protocol implementations, specifically when
 * implementing {@link HttpBindingProtocolGenerator#generateDocumentBodyShapeDeserializers(GenerationContext, Set)}.
 *
 * Implementations of this class independent of protocol documents are also possible.
 *
 * The standard implementation is as follows; no assumptions are made about the protocol
 * being generated for.
 *
 * <ul>
 *   <li>Service, Operation, Resource: no function generated. <b>Not overridable.</b></li>
 *   <li>Document, List, Map, Set, Structure, Union: generates a deserialization function.
 *     <b>Not overridable.</b></li>
 *   <li>All other types: no function generated. <b>May be overridden.</b></li>
 * </ul>
 */
@SmithyUnstableApi
public abstract class DocumentShapeDeserVisitor extends ShapeVisitor.Default<Void> {
    private final GenerationContext context;

    public DocumentShapeDeserVisitor(GenerationContext context) {
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
     * Writes the code needed to deserialize a collection in the document of a response.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns the type generated for the CollectionShape {@code shape} parameter from an input
     * deserialized by {@code deserializeOutputDocument}.
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
     *   <li>{@code output: any}: a value for the CollectionShape shape parameter deserialized from the document.</li>
     *   <li>{@code context: SerdeContext}: a TypeScript type containing context and tools for type serde.</li>
     * </ul>
     *
     * <p>The function signature specifies an {@code Array&lt;Parameter&gt;} return type.
     *
     * <p>This function would generate the following:
     *
     * <pre>{@code
     * return (output || []).map((entry: any) =>
     *   deserializeAws_restJson1_1Parameter(entry, context)
     * );
     * }</pre>
     *
     * <p>{@code Set} types will be generated appropriately for signatures when given.
     *
     * @param context The generation context.
     * @param shape The collection shape being generated.
     */
    protected abstract void deserializeCollection(GenerationContext context, CollectionShape shape);

    /**
     * Writes the code needed to deserialize a document in the document of a response.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns the type generated for the DocumentShape {@code shape} parameter from an input
     * deserialized by {@code deserializeDocument}.
     *
     * <p>For example, given the following Smithy model:
     *
     * <pre>{@code
     * document FooDocument
     * }</pre>
     *
     * <p>The function signature for this body will have two parameters available in scope:
     * <ul>
     *   <li>{@code output: any}: a value for the DocumentShape shape parameter deserialized from the document.</li>
     *   <li>{@code context: SerdeContext}: a TypeScript type containing context and tools for type serde.</li>
     * </ul>
     *
     * <p>The function signature specifies a {@code FooDocument} return type.
     *
     * <p>This function would generate the following:
     *
     * <pre>{@code
     * return JSON.parse(output);
     * }</pre>
     *
     * @param context The generation context.
     * @param shape The document shape being generated.
     */
    protected abstract void deserializeDocument(GenerationContext context, DocumentShape shape);

    /**
     * Writes the code needed to deserialize a map in the document of a response.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns the type generated for the MapShape {@code shape} parameter from an input
     * deserialized by {@code deserializeOutputDocument}.
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
     *   <li>{@code output: any}: a value for the MapShape shape parameter deserialized from the document.</li>
     *   <li>{@code context: SerdeContext}: a TypeScript type containing context and tools for type serde.</li>
     * </ul>
     *
     * <p>The function signature specifies a {@code { [key: string]: Field }} return type.
     *
     * <p>This function would generate the following:
     *
     * <pre>{@code
     * let mapParams: any = {};
     * Object.keys(output).forEach(key => {
     *   mapParams[key] = deserializeAws_restJson1_1Field(output[key], context);
     * });
     * return mapParams;
     * }</pre>
     *
     * @param context The generation context.
     * @param shape The map shape being generated.
     */
    protected abstract void deserializeMap(GenerationContext context, MapShape shape);

    /**
     * Writes the code needed to deserialize a structure in the document of a response.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns the type generated for the StructureShape {@code shape} parameter from an input
     * deserialized by {@code deserializeOutputDocument}.
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
     *   <li>{@code output: any}: a value for the StructureShape shape parameter deserialized from the document.</li>
     *   <li>{@code context: SerdeContext}: a TypeScript type containing context and tools for type serde.</li>
     * </ul>
     *
     * <p>The function signature specifies a {@code Field} return.
     *
     * <p>This function would generate the following:
     *
     * <pre>{@code
     * let contents: any = {
     *   fooValue: undefined,
     *   barValue: undefined,
     * };
     * if (output.fooValue !== undefined) {
     *   contents.fooValue = deserializeAws_restJson1_1Foo(output.fooValue, context);
     * }
     * if (output.barValue !== undefined) {
     *   contents.barValue = output.barValue;
     * }
     * return contents;
     * }</pre>
     *
     * @param context The generation context.
     * @param shape The structure shape being generated.
     */
    protected abstract void deserializeStructure(GenerationContext context, StructureShape shape);

    /**
     * Writes the code needed to deserialize a union in the document of a response.
     *
     * <p>Implementations of this method are expected to generate a function body that
     * returns the type generated for the UnionShape {@code shape} parameter from an input
     * deserialized by {@code deserializeOutputDocument}.
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
     *   <li>{@code output: any}: a value for the UnionShape shape parameter deserialized from the document.</li>
     *   <li>{@code context: SerdeContext}: a TypeScript type containing context and tools for type serde.</li>
     * </ul>
     *
     * <p>The function signature specifies a {@code Field} return type.
     *
     * <p>This function would generate the following:
     *
     * <pre>{@code
     * if (output.fooValue !== undefined) {
     *   return {
     *     fooValue: deserializeAws_restJson1_1Foo(output.fooValue, context)
     *   };
     * }
     * if (output.barValue !== undefined) {
     *   return {
     *     barValue: output.barValue
     *   };
     * }
     * return { $unknown: output[Object.keys(output)[0]] };
     * }</pre>
     *
     * @param context The generation context.
     * @param shape The union shape being generated.
     */
    protected abstract void deserializeUnion(GenerationContext context, UnionShape shape);

    /**
     * Generates a function for serializing the input shape, dispatching the body generation
     * to the supplied function.
     *
     * @param shape The shape to generate a serializer for.
     * @param functionBody An implementation that will generate a function body to
     *                     serialize the shape.
     */
    protected final void generateDeserFunction(
            Shape shape,
            BiConsumer<GenerationContext, Shape> functionBody
    ) {
        SymbolProvider symbolProvider = context.getSymbolProvider();
        TypeScriptWriter writer = context.getWriter();

        Symbol symbol = symbolProvider.toSymbol(shape);
        // Use the shape name for the function name.
        String methodName = ProtocolGenerator.getDeserFunctionName(symbol, context.getProtocolName());

        writer.addImport(symbol, symbol.getName());
        writer.openBlock("const $L = (\n"
                       + "  output: any,\n"
                       + "  context: __SerdeContext\n"
                       + "): $T => {", "}", methodName, symbol, () -> functionBody.accept(context, shape));
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
     * Dispatches to create the body of map shape deserialization functions.
     * The function signature will be generated.
     *
     * <p>For example, given the following Smithy model:
     *
     * <pre>{@code
     * document FooDocument
     * }</pre>
     *
     * <p>The following code is generated for a deserializer</p>
     *
     * <pre>{@code
     * const deserializeAws_restJson1_1FooDocument = (
     *   output: any,
     *   context: SerdeContext
     * ): FooDocument => {
     *   return JSON.parse(output);
     * }
     * }</pre>
     * @param shape The map shape to generate deserialization for.
     * @return Null.
     */
    @Override
    public final Void documentShape(DocumentShape shape) {
        generateDeserFunction(shape, (c, s) -> deserializeDocument(c, s.asDocumentShape().get()));
        return null;
    }

    /**
     * Dispatches to create the body of list shape deserialization functions.
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
     * <p>The following code is generated for a deserializer</p>
     *
     * <pre>{@code
     * const deserializeAws_restJson1_1ParameterList = (
     *   output: any,
     *   context: SerdeContext
     * ): Parameter[] => {
     *   return (output || []).map((entry: any) =>
     *     deserializeAws_restJson1_1Parameter(entry, context)
     *   );
     * }
     * }</pre>
     *
     * @param shape The list shape to generate deserialization for.
     * @return Null.
     */
    @Override
    public final Void listShape(ListShape shape) {
        generateDeserFunction(shape, (c, s) -> deserializeCollection(c, s.asListShape().get()));
        return null;
    }

    /**
     * Dispatches to create the body of map shape deserialization functions.
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
     * <p>The following code is generated for a deserializer</p>
     *
     * <pre>{@code
     * const deserializeAws_restJson1_1FieldMap = (
     *   output: any,
     *   context: SerdeContext
     * ): { [key: string]: Field } => {
     *   let mapParams: any = {};
     *   Object.keys(output).forEach(key => {
     *     mapParams[key] = deserializeAws_restJson1_1Field(output[key], context);
     *   });
     *   return mapParams;
     * }
     * }</pre>
     * @param shape The map shape to generate deserialization for.
     * @return Null.
     */
    @Override
    public final Void mapShape(MapShape shape) {
        generateDeserFunction(shape, (c, s) -> deserializeMap(c, s.asMapShape().get()));
        return null;
    }

    /**
     * Dispatches to create the body of set shape deserialization functions.
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
     * <p>The following code is generated for a deserializer</p>
     *
     * <pre>{@code
     * const deserializeAws_restJson1_1ParameterSet = (
     *   output: any,
     *   context: SerdeContext
     * ): Parameter[] => {
     *   return (output || []).map((entry: any) =>
     *     deserializeAws_restJson1_1Parameter(entry, context)
     *   );
     * }
     * }</pre>
     *
     * @param shape The set shape to generate deserialization for.
     * @return Null.
     */
    @Override
    public final Void setShape(SetShape shape) {
        generateDeserFunction(shape, (c, s) -> deserializeCollection(c, s.asSetShape().get()));
        return null;
    }

    /**
     * Dispatches to create the body of structure shape deserialization functions.
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
     * <p>The following code is generated for a deserializer</p>
     *
     * <pre>{@code
     * const deserializeAws_restJson1_1Field = (
     *   output: any,
     *   context: SerdeContext
     * ): Field => {
     *   let field: any = {
     *     fooValue: undefined,
     *     barValue: undefined,
     *   };
     *   if (output.fooValue !== undefined) {
     *     field.fooValue = deserializeAws_restJson1_1Foo(output.fooValue, context);
     *   }
     *   if (output.barValue !== undefined) {
     *     field.barValue = output.barValue;
     *   }
     *   return field;
     * }
     * }</pre>
     *
     * @param shape The structure shape to generate deserialization for.
     * @return Null.
     */
    @Override
    public final Void structureShape(StructureShape shape) {
        generateDeserFunction(shape, (c, s) -> deserializeStructure(c, s.asStructureShape().get()));
        return null;
    }

    /**
     * Dispatches to create the body of union shape deserialization functions.
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
     * <p>The following code is generated for a deserializer</p>
     *
     * <pre>{@code
     * const deserializeAws_restJson1_1Field = (
     *   output: any,
     *   context: SerdeContext
     * ): Field => {
     *   if (output.fooValue !== undefined) {
     *     return {
     *       fooValue: deserializeAws_restJson1_1Foo(output.fooValue, context)
     *     };
     *   }
     *   if (output.barValue !== undefined) {
     *     return {
     *       barValue: output.barValue
     *     };
     *   }
     *   return { $unknown: output[Object.keys(output)[0]] };
     * }
     * }</pre>
     *
     * @param shape The union shape to generate deserialization for.
     * @return Null.
     */
    @Override
    public final Void unionShape(UnionShape shape) {
        generateDeserFunction(shape, (c, s) -> deserializeUnion(c, s.asUnionShape().get()));
        return null;
    }
}
