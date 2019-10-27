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

import static software.amazon.smithy.model.knowledge.HttpBinding.Location;

import java.util.List;
import java.util.logging.Logger;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.knowledge.HttpBinding;
import software.amazon.smithy.model.knowledge.HttpBindingIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.BlobShape;
import software.amazon.smithy.model.shapes.BooleanShape;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.NumberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeIndex;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.traits.HttpTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.typescript.codegen.ApplicationProtocol;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.OptionalUtils;

/**
 * Abstract implementation useful for all protocols that use HTTP bindings.
 */
public abstract class HttpBindingProtocolGenerator implements ProtocolGenerator {

    private static final Logger LOGGER = Logger.getLogger(HttpBindingProtocolGenerator.class.getName());

    @Override
    public ApplicationProtocol getApplicationProtocol() {
        return ApplicationProtocol.createDefaultHttpApplicationProtocol();
    }

    @Override
    public void generateRequestSerializers(GenerationContext context) {
        TopDownIndex topDownIndex = context.getModel().getKnowledge(TopDownIndex.class);
        for (OperationShape operation : topDownIndex.getContainedOperations(context.getService())) {
            OptionalUtils.ifPresentOrElse(
                    operation.getTrait(HttpTrait.class),
                    httpTrait -> generateOperationSerializer(context, operation, httpTrait),
                    () -> LOGGER.warning(String.format(
                            "Unable to generate %s protocol request bindings for %s because it does not have an "
                            + "http binding trait", getName(), operation.getId())));
        }
    }

    @Override
    public void generateResponseDeserializers(GenerationContext context) {
        TopDownIndex topDownIndex = context.getModel().getKnowledge(TopDownIndex.class);
        for (OperationShape operation : topDownIndex.getContainedOperations(context.getService())) {
            OptionalUtils.ifPresentOrElse(
                    operation.getTrait(HttpTrait.class),
                    httpTrait -> generateOperationDeserializer(context, operation, httpTrait),
                    () -> LOGGER.warning(String.format(
                            "Unable to generate %s protocol response bindings for %s because it does not have an "
                            + "http binding trait", getName(), operation.getId())));
        }
    }

    private void generateOperationSerializer(GenerationContext context, OperationShape operation, HttpTrait trait) {
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(operation);
        SymbolReference requestType = getApplicationProtocol().getRequestType();
        HttpBindingIndex bindingIndex = context.getModel().getKnowledge(HttpBindingIndex.class);
        TypeScriptWriter writer = context.getWriter();

        // Ensure that the request type is imported.
        writer.addUseImports(requestType);
        writer.addImport("SerdeContext", "SerdeContext", "@aws-sdk/types");
        writer.addImport("Endpoint", "__Endpoint", "@aws-sdk/types");
        // e.g., serializeAws_restJson1_1ExecuteStatement
        String serializerMethodName = "serialize" + ProtocolGenerator.getSanitizedName(getName()) + symbol.getName();
        // Add the normalized input type.
        String inputType = symbol.getName() + "Input";
        writer.addImport(inputType, inputType, symbol.getNamespace());

        writer.openBlock("export function $L(\n"
                         + "  input: $L,\n"
                         + "  context: SerdeContext\n"
                         + "): $T {", "}", serializerMethodName, inputType, requestType, () -> {
            List<HttpBinding> labelBindings = writeRequestLabels(context, operation, bindingIndex, trait);
            List<HttpBinding> queryBindings = writeRequestQueryString(context, operation, bindingIndex);
            writeHeaders(context, operation, bindingIndex);
            List<HttpBinding> documentBindings = writeRequestBody(context, operation, bindingIndex);

            writer.openBlock("return new $T({", "});", requestType, () -> {
                writer.write("...context.endpoint,");
                writer.write("protocol: \"https\",");
                writer.write("method: $S,", trait.getMethod());
                if (labelBindings.isEmpty()) {
                    writer.write("path: $S,", trait.getUri());
                } else {
                    writer.write("path: resolvedPath,");
                }
                writer.write("headers: headers,");
                if (!documentBindings.isEmpty()) {
                    writer.write("body: body,");
                }
                if (!queryBindings.isEmpty()) {
                    writer.write("query: query,");
                }
            });
        });

        writer.write("");
    }

    private List<HttpBinding> writeRequestLabels(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex,
            HttpTrait trait
    ) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        List<HttpBinding> labelBindings = bindingIndex.getRequestBindings(operation, Location.LABEL);

        if (!labelBindings.isEmpty()) {
            ShapeIndex index = context.getModel().getShapeIndex();
            writer.write("let resolvedPath = $S;", trait.getUri());
            for (HttpBinding binding : labelBindings) {
                String memberName = symbolProvider.toMemberName(binding.getMember());
                writer.openBlock("if (input.$L !== undefined) {", "}", memberName, () -> {
                    Shape target = index.getShape(binding.getMember().getTarget()).get();
                    String labelValue = getInputValue(binding.getLocation(), operation, binding.getMember(), target);
                    writer.write("resolvedPath = resolvedPath.replace('{$1S}', $L);", labelValue);
                });
            }
        }

        return labelBindings;
    }

    private List<HttpBinding> writeRequestQueryString(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex
    ) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();
        List<HttpBinding> queryBindings = bindingIndex.getRequestBindings(operation, Location.QUERY);

        if (!queryBindings.isEmpty()) {
            ShapeIndex index = context.getModel().getShapeIndex();
            writer.write("let query = {};");
            for (HttpBinding binding : queryBindings) {
                String memberName = symbolProvider.toMemberName(binding.getMember());
                writer.openBlock("if (input.$L !== undefined) {", "}", memberName, () -> {
                    Shape target = index.getShape(binding.getMember().getTarget()).get();
                    String queryValue = getInputValue(binding.getLocation(), operation, binding.getMember(), target);
                    writer.write("query['$L'] = $L;", binding.getLocationName(), queryValue);
                });
            }
        }

        return queryBindings;
    }

    private String getInputValue(
            Location bindingType,
            OperationShape operation,
            MemberShape member,
            Shape target
    ) {
        String memberName = member.getMemberName();

        if (target instanceof StringShape) {
            return "input." + memberName;
        } else if (target instanceof BooleanShape || target instanceof NumberShape) {
            // Just toString on the value.
            return "input." + memberName + ".toString()";
        } else if (target instanceof TimestampShape) {
            return getTimestampInputParam(member, bindingType);
        } else if (target instanceof BlobShape) {
            // base64 encode
            // TODO: fixme (how do we base64 encode?)
            throw new UnsupportedOperationException("Not yet implemented");
        } else if (target instanceof CollectionShape) {
            // TODO: fixme
            throw new UnsupportedOperationException("Not yet implemented");
        }

        throw new CodegenException(String.format(
                "Unsupported %s string binding of %s to %s in %s using the %s protocol",
                bindingType, memberName, target.getType(), operation, getName()));
    }

    private static String getTimestampInputParam(MemberShape member, Location bindingType) {
        String value = resolveTimestampFormat(member, bindingType);
        switch (value) {
            case TimestampFormatTrait.DATE_TIME:
                return "input." + member.getMemberName() + ".toISOString()";
            case TimestampFormatTrait.EPOCH_SECONDS:
                return "Math.round(input." + member.getMemberName() + ".getTime() / 1000)";
            case TimestampFormatTrait.HTTP_DATE:
                return "input." + member.getMemberName() + ".toUTCString()";
            default:
                throw new CodegenException("Unexpected timestamp format `" + value + "` on " + member);
        }
    }

    // TODO: make this a generic feature of HTTP bindings somehow.
    private static String resolveTimestampFormat(MemberShape member, Location bindingType) {
        return member.getTrait(TimestampFormatTrait.class).map(TimestampFormatTrait::getValue).orElseGet(() -> {
            switch (bindingType) {
                case LABEL:
                case QUERY:
                    return TimestampFormatTrait.DATE_TIME;
                case HEADER:
                    return TimestampFormatTrait.HTTP_DATE;
                default:
                    throw new CodegenException("Unexpected timestamp binding location: " + bindingType);
            }
        });
    }

    private void writeHeaders(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex
    ) {
        TypeScriptWriter writer = context.getWriter();
        SymbolProvider symbolProvider = context.getSymbolProvider();

        // Headers are always present either from the default document or the payload.
        writer.write("let headers: any = {};");
        writer.write("headers['Content-Type'] = $S;", bindingIndex.determineRequestContentType(
                operation, getDocumentContentType()));

        ShapeIndex index = context.getModel().getShapeIndex();
        for (HttpBinding binding : bindingIndex.getRequestBindings(operation, Location.HEADER)) {
            String memberName = symbolProvider.toMemberName(binding.getMember());
            writer.openBlock("if (input.$L !== undefined) {", "}", memberName, () -> {
                Shape target = index.getShape(binding.getMember().getTarget()).get();
                String headerValue = getInputValue(binding.getLocation(), operation, binding.getMember(), target);
                writer.write("headers['$L'] = $L;", binding.getLocationName(), headerValue);
            });
        }

        for (HttpBinding binding : bindingIndex.getRequestBindings(operation, Location.PREFIX_HEADERS)) {
            // TODO: httpPrefixHeader params. fixme
            throw new UnsupportedOperationException("Not yet implemented: " + binding);
        }
    }

    private List<HttpBinding> writeRequestBody(
            GenerationContext context,
            OperationShape operation,
            HttpBindingIndex bindingIndex
    ) {
        // Write the default `body` property.
        context.getWriter().write("let body: any = undefined;");
        List<HttpBinding> documentBindings = bindingIndex.getRequestBindings(operation, Location.DOCUMENT);
        if (!documentBindings.isEmpty()) {
            serializeDocument(context, operation, bindingIndex.getRequestBindings(operation, Location.DOCUMENT));
        }

        return documentBindings;
    }

    /**
     * Gets the default content-type when a document is synthesized in the body.
     *
     * @return Returns the default content-type.
     */
    protected abstract String getDocumentContentType();

    /**
     * Writes the code needed to serialize the input document of a request.
     *
     * @param context The generation context.
     * @param operation The operation being generated.
     * @param documentBindings The bindings to place in the document.
     */
    protected abstract void serializeDocument(
            GenerationContext context,
            OperationShape operation,
            List<HttpBinding> documentBindings
    );

    private void generateOperationDeserializer(GenerationContext context, OperationShape operation, HttpTrait trait) {
        SymbolProvider symbolProvider = context.getSymbolProvider();
        Symbol symbol = symbolProvider.toSymbol(operation);
        SymbolReference responseType = getApplicationProtocol().getResponseType();
        HttpBindingIndex bindingIndex = context.getModel().getKnowledge(HttpBindingIndex.class);
        TypeScriptWriter writer = context.getWriter();

        // Ensure that the response type is imported.
        writer.addUseImports(responseType);
        writer.addImport("SerdeContext", "SerdeContext", "@aws-sdk/types");
        // e.g., deserializeAws_restJson1_1ExecuteStatement
        String methodName = "deserialize" + ProtocolGenerator.getSanitizedName(getName()) + symbol.getName();

        // Add the normalized output type.
        String outputType = symbol.getName() + "Output";
        writer.addImport(outputType, outputType, symbol.getNamespace());

        writer.openBlock("export function $L(\n"
                         + "  output: $T,\n"
                         + "  context: SerdeContext\n"
                         + "): Promise<$L> {", "}", methodName, responseType, outputType, () -> {
            // TODO: Check status code to create appropriate error type or response type.
            writeHeaders(context, operation, bindingIndex);
            // TODO: response body deserialization.
        });

        writer.write("");
    }
}
