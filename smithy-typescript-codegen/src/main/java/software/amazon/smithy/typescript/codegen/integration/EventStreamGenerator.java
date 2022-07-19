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

import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.EventStreamIndex;
import software.amazon.smithy.model.knowledge.EventStreamInfo;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.BlobShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.ErrorTrait;
import software.amazon.smithy.model.traits.EventHeaderTrait;
import software.amazon.smithy.model.traits.EventPayloadTrait;
import software.amazon.smithy.model.traits.StreamingTrait;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator.GenerationContext;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Evnetstream code generator.
 */
@SmithyUnstableApi
public class EventStreamGenerator {
    public static boolean isEventStreamShape(Shape shape) {
        return shape instanceof UnionShape && shape.hasTrait(StreamingTrait.class);
    }

    /**
     * Generate eventstream serializers, and related serializers for events.
     * @param context Code generation context instance.
     * @param service The service shape.
     * @param documentContentType The default content-type value of current protocol.
     * @param getEventHeaderInputValue The function that given a source of data, generate an input value provider for a
     *                                  given shape that bind to event header. It takes 2 parameters: dataSource--the
     *                                  in-code location of the data to provide an input of ({@code input.foo},
     *                                  {@code entry}, etc.); member--the member that points to the value being
     *                                  provided. The function retuns a value or expression of the input value.
     * @param getEventPayloadInputValue The function that given a source of data, generate an input value provider for a
     *                                  given shape that bind to event payload. It takes 2 parameters: dataSource--the
     *                                  in-code location of the data to provide an input of ({@code input.foo},
     *                                  {@code entry}, etc.); member--the member that points to the value being
     *                                  provided. The function retuns a value or expression of the input value.
     * @param serializeInputEventDocumentPayload Function writes the code needed to serialize an event payload as a
     *                                          protocol-specific document.
     * @param documentShapesToSerialize The set of shapes that needs to be serialized as document payload.
     *                                  Shapes that referred by event will be added.
     */
    public void generateEventStreamSerializers(
        GenerationContext context,
        ServiceShape service,
        String documentContentType,
        BiFunction<String, MemberShape, String> getEventHeaderInputValue,
        BiFunction<String, MemberShape, String> getEventPayloadInputValue,
        Consumer<GenerationContext> serializeInputEventDocumentPayload,
        Set<Shape> documentShapesToSerialize
    ) {
        Model model = context.getModel();

        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> operations = topDownIndex.getContainedOperations(service);
        EventStreamIndex eventStreamIndex = EventStreamIndex.of(model);
        TreeSet<UnionShape> eventUnionsToSerialize = new TreeSet<>();
        TreeSet<StructureShape> eventShapesToMarshall = new TreeSet<>();
        for (OperationShape operation : operations) {
            if (eventStreamIndex.getInputInfo(operation).isPresent()) {
                EventStreamInfo eventStreamInfo = eventStreamIndex.getInputInfo(operation).get();
                UnionShape eventsUnion = eventStreamInfo.getEventStreamTarget().asUnionShape().get();
                eventUnionsToSerialize.add(eventsUnion);
                Set<StructureShape> eventShapes = eventsUnion.members().stream()
                        .map(member -> model.expectShape(member.getTarget()).asStructureShape().get())
                        .collect(Collectors.toSet());
                eventShapes.forEach(eventShapesToMarshall::add);
            }
        }

        eventUnionsToSerialize.forEach(eventsUnion -> {
            generateEventStreamSerializer(context, eventsUnion);
        });
        eventShapesToMarshall.forEach(event -> {
            generateEventMarshaller(
                context,
                event,
                documentContentType,
                getEventHeaderInputValue,
                getEventPayloadInputValue,
                serializeInputEventDocumentPayload,
                documentShapesToSerialize);
        });
    }

    /**
     * Generate eventstream deserializers, and related deserializers for events.
     * @param context Code generation context instance.
     * @param service The service shape.
     * @param errorShapesToDeserialize A set of error shapes referred by events will be added to this set.
     * @param eventShapesToDeserialize A set of event shapes that needs to be treated as regular structure shapes will
     *                                  be added to this set.
     * @param isErrorCodeInBody A boolean that indicates if the error code for the implementing protocol is located in
     *                          the error response body, meaning this generator will parse the body before attempting to
     *                          load an error code.
     * @param getEventHeaderOutputValue The function that given a source of data, generate an output value provider for
     *                                  a given shape that bind to event header. This may use native types (like
     *                                  generating a Date for timestamps,) converters (like a base64Decoder,) or invoke
     *                                  complex type deserializers to manipulate the dataSource into the proper output
     *                                  content. It takes 2 parameters: dataSource--the in-code location of the data to
     *                                  provide an output of ({@code output.foo}, {@code entry}, etc.); member--the
     *                                  member that points to the value being provided. The function retuns a value or
     *                                  expression of the output value.
     */
    public void generateEventStreamDeserializers(
        GenerationContext context,
        ServiceShape service,
        Set<StructureShape> errorShapesToDeserialize,
        Set<Shape> eventShapesToDeserialize,
        boolean isErrorCodeInBody,
        BiFunction<String, MemberShape, String> getEventHeaderOutputValue
    ) {
        Model model = context.getModel();

        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> operations = topDownIndex.getContainedOperations(service);
        EventStreamIndex eventStreamIndex = EventStreamIndex.of(model);
        TreeSet<UnionShape> eventUnionsToDeserialize = new TreeSet<>();
        TreeSet<StructureShape> eventShapesToUnmarshall = new TreeSet<>();
        for (OperationShape operation : operations) {
            if (eventStreamIndex.getOutputInfo(operation).isPresent()) {
                EventStreamInfo eventStreamInfo = eventStreamIndex.getOutputInfo(operation).get();
                UnionShape eventsUnion = eventStreamInfo.getEventStreamTarget().asUnionShape().get();
                eventUnionsToDeserialize.add(eventsUnion);
                Set<StructureShape> eventShapes = eventsUnion.members().stream()
                        .map(member -> model.expectShape(member.getTarget()).asStructureShape().get())
                        .collect(Collectors.toSet());
                eventShapes.forEach(eventShapesToUnmarshall::add);
            }
        }

        eventUnionsToDeserialize.forEach(eventsUnion -> {
            generateEventStreamDeserializer(context, eventsUnion);
        });
        eventShapesToUnmarshall.forEach(event -> {
            generateEventUnmarshaller(
                context,
                event,
                errorShapesToDeserialize,
                eventShapesToDeserialize,
                isErrorCodeInBody,
                getEventHeaderOutputValue
            );
        });
    }

    private void generateEventStreamSerializer(GenerationContext context, UnionShape eventsUnion) {
        String methodName = getSerFunctionName(context, eventsUnion);
        Symbol eventsUnionSymbol = getSymbol(context, eventsUnion);
        TypeScriptWriter writer = context.getWriter();
        Model model = context.getModel();
        writer.addImport("Message", "__Message", TypeScriptDependency.AWS_SDK_TYPES.packageName);
        writer.openBlock("const $L = (\n"
                + "  input: any,\n"
                + "  context: $L\n"
                + "): any => {", "}", methodName, getEventStreamSerializerContextType(context, eventsUnion), () -> {
            writer.openBlock("const eventMarshallingVisitor = (event: any): __Message => $T.visit(event, {", "});",
                    eventsUnionSymbol, () -> {
                        eventsUnion.getAllMembers().forEach((memberName, memberShape) -> {
                            StructureShape target = model.expectShape(memberShape.getTarget(), StructureShape.class);
                            String eventSerMethodName = getEventSerFunctionName(context, target);
                            writer.write("$L: value => $L(value, context),", memberName, eventSerMethodName);
                        });
                        writer.write("_: value => value as any");
                    });
            writer.write("return context.eventStreamMarshaller.serialize(input, eventMarshallingVisitor);");
        });
    }

    private String getSerFunctionName(GenerationContext context, Shape shape) {
        Symbol symbol = getSymbol(context, shape);
        String protocolName = context.getProtocolName();
        return ProtocolGenerator.getSerFunctionName(symbol, protocolName);
    }

    public String getEventSerFunctionName(GenerationContext context, Shape shape) {
        return getSerFunctionName(context, shape) + "_event";
    }

    private String getEventStreamSerializerContextType(GenerationContext context, UnionShape eventsUnion) {
        TypeScriptWriter writer = context.getWriter();
        writer.addImport("SerdeContext", "__SerdeContext", TypeScriptDependency.AWS_SDK_TYPES.packageName);
        String contextType = "__SerdeContext";
        if (eventsUnion.hasTrait(StreamingTrait.class)) {
            writer.addImport("EventStreamSerdeContext", "__EventStreamSerdeContext",
                    TypeScriptDependency.AWS_SDK_TYPES.packageName);
            contextType += " & __EventStreamSerdeContext";
        }
        return contextType;
    }

    private Symbol getSymbol(GenerationContext context, Shape shape) {
        SymbolProvider symbolProvider = context.getSymbolProvider();
        return symbolProvider.toSymbol(shape);
    }

    public void generateEventMarshaller(
        GenerationContext context,
        StructureShape event,
        String documentContentType,
        BiFunction<String, MemberShape, String> getEventHeaderInputValue,
        BiFunction<String, MemberShape, String> getEventPayloadInputValue,
        Consumer<GenerationContext> serializeInputEventDocumentPayload,
        Set<Shape> documentShapesToSerialize
    ) {
        String methodName = getEventSerFunctionName(context, event);
        Symbol symbol = getSymbol(context, event);
        TypeScriptWriter writer = context.getWriter();
        writer.addImport("MessageHeaders", "__MessageHeaders", TypeScriptDependency.AWS_SDK_TYPES.packageName);
        writer.openBlock("const $L = (\n"
                + "  input: $T,\n"
                + "  context: __SerdeContext\n"
                + "): __Message => {", "}", methodName, symbol, () -> {
            writer.openBlock("const headers: __MessageHeaders = {", "}", () -> {
                //fix headers required by event stream
                writer.write("\":event-type\": { type: \"string\", value: $S },", symbol.getName());
                writer.write("\":message-type\": { type: \"string\", value: \"event\" },");
                writeEventContentTypeHeader(context, event, documentContentType);
            });
            writeEventHeaders(context, event, getEventHeaderInputValue);
            writeEventBody(context, event, getEventPayloadInputValue, serializeInputEventDocumentPayload,
                    documentShapesToSerialize);
            writer.openBlock("return { headers, body };");
        });
    }

    private void writeEventContentTypeHeader(
        GenerationContext context,
        StructureShape event,
        String documentContentType
    ) {
        TypeScriptWriter writer = context.getWriter();
        Shape payloadShape = getEventPayloadShape(context, event);
        if (payloadShape instanceof BlobShape) {
            writer.write("\":content-type\": { type: \"string\", value: \"application/octet-stream\" },");
        } else if (payloadShape instanceof StringShape) {
            writer.write("\":content-type\": { type: \"string\", value: \"text/plain\" },");
        } else if (payloadShape instanceof StructureShape || payloadShape instanceof UnionShape) {
            writer.write("\":content-type\": { type: \"string\", value: $S },", documentContentType);
        } else {
            throw new CodegenException(String.format("Unexpected shape type bound to event payload: `%s`",
                    payloadShape.getType()));
        }
    }

    private Shape getEventPayloadShape(GenerationContext context, StructureShape event) {
        Model model = context.getModel();
        List<MemberShape> payloadMembers = event.getAllMembers().values().stream()
                .filter(member -> member.hasTrait(EventPayloadTrait.class))
                .collect(Collectors.toList());
        return payloadMembers.isEmpty()
                        ? event // implicit payload
                        : model.expectShape(payloadMembers.get(0).getTarget());
    }

    private void writeEventHeaders(
        GenerationContext context,
        StructureShape event,
        BiFunction<String, MemberShape, String> getEventHeaderInputValue
    ) {
        TypeScriptWriter writer = context.getWriter();
        Model model = context.getModel();
        List<MemberShape> headerMembers = event.getAllMembers().values().stream()
                .filter(member -> member.hasTrait(EventHeaderTrait.class)).collect(Collectors.toList());
        for (MemberShape headerMember : headerMembers) {
            String memberName = headerMember.getMemberName();
            Shape target = model.expectShape(headerMember.getTarget());
            writer.openBlock("if (input.$L) {", "}", memberName, () -> {
                writer.write("headers[$S] = { type: $S, value: $L }", memberName,
                        getEventHeaderType(headerMember),
                        getEventHeaderInputValue.apply("input." + memberName, headerMember));
            });
        }
    }

    /**
     * The value of event header 'type' property of given shape.
     */
    private String getEventHeaderType(Shape shape) {
        switch (shape.getType()) {
            case BOOLEAN:
            case BYTE:
            case SHORT:
            case INTEGER:
            case LONG:
            case STRING:
            case TIMESTAMP:
                return shape.getType().toString();
            case BLOB:
                return "binary";
            default:
                return "binary";
        }
    }

    private void writeEventBody(
        GenerationContext context,
        StructureShape event,
        BiFunction<String, MemberShape, String> getEventPayloadInputValue,
        Consumer<GenerationContext> serializeInputEventDocumentPayload,
        Set<Shape> documentShapesToSerialize
    ) {
        TypeScriptWriter writer = context.getWriter();
        Shape payloadShape = getEventPayloadShape(context, event);
        if (payloadShape instanceof BlobShape || payloadShape instanceof StringShape) {
            // Since event itself must be a structure shape, so string or blob payload member must has eventPayload
            // trait explicitly.
            MemberShape payloadMember = event.getAllMembers().values().stream()
                    .filter(member -> member.hasTrait(EventPayloadTrait.class))
                    .collect(Collectors.toList()).get(0);
            String payloadMemberName = payloadMember.getMemberName();
            writer.write("const body = $L || new Uint8Array();",
                    getEventPayloadInputValue.apply("input." + payloadMemberName, payloadMember));
        } else if (payloadShape instanceof StructureShape || payloadShape instanceof UnionShape) {
            // handle implicit event payload by removing members with eventHeader trait.
            for (MemberShape memberShape : event.members()) {
                if (memberShape.hasTrait(EventHeaderTrait.class)) {
                    writer.write("delete input[$S]", memberShape.getMemberName());
                }
            }
            Symbol symbol = getSymbol(context, payloadShape);
            String serFunctionName = ProtocolGenerator.getSerFunctionName(symbol, context.getProtocolName());
            documentShapesToSerialize.add(payloadShape);
            writer.write("let body = $L(input, context);", serFunctionName);
            serializeInputEventDocumentPayload.accept(context);
        } else {
            throw new CodegenException(String.format("Unexpected shape type bound to event payload: `%s`",
                    payloadShape.getType()));
        }
    }

    private void generateEventStreamDeserializer(GenerationContext context, UnionShape eventsUnion) {
        String methodName = getDeserFunctionName(context, eventsUnion);
        Symbol eventsUnionSymbol = getSymbol(context, eventsUnion);
        TypeScriptWriter writer = context.getWriter();
        Model model = context.getModel();
        String contextType = getEventStreamSerializerContextType(context, eventsUnion);
        writer.openBlock("const $L = (\n"
                + "  output: any,\n"
                + "  context: $L\n"
                + "): AsyncIterable<$T> => {", "}", methodName, contextType, eventsUnionSymbol, () -> {
            writer.openBlock("return context.eventStreamMarshaller.deserialize(", ");", () -> {
                writer.write("output,");
                writer.openBlock("async event => {", "}", () -> {
                    writer.write("const eventName = Object.keys(event)[0];");
                    writer.openBlock(
                                "const eventHeaders = Object.entries(event[eventName].headers).reduce(", ");", () -> {
                        writer.write(
                            "(accummulator, curr) => {accummulator[curr[0]] = curr[1].value; return accummulator; },");
                        writer.write("{} as Record<string, any>");
                    });
                    writer.openBlock("const eventMessage = {", "};", () -> {
                        writer.write("headers: eventHeaders,");
                        writer.write("body: event[eventName].body");
                    });
                    writer.openBlock("const parsedEvent = {", "};", () -> {
                        writer.write("[eventName]: eventMessage");
                    });
                    eventsUnion.getAllMembers().forEach((name, member) -> {
                        StructureShape event = model.expectShape(member.getTarget(), StructureShape.class);
                        writer.openBlock("if (parsedEvent[$S] !== undefined) {", "}", name, () -> {
                            writer.openBlock("return {", "};", () -> {
                                String eventDeserMethodName = getEventDeserFunctionName(context, event);
                                writer.write("$1L: await $2L(parsedEvent[$1S], context),", name, eventDeserMethodName);
                            });
                        });
                    });
                    writer.write("return {$$unknown: output};");
                });
            });
        });
    }

    private String getDeserFunctionName(GenerationContext context, Shape shape) {
        Symbol symbol = getSymbol(context, shape);
        String protocolName = context.getProtocolName();
        return ProtocolGenerator.getDeserFunctionName(symbol, protocolName);
    }

    public String getEventDeserFunctionName(GenerationContext context, Shape shape) {
        return getDeserFunctionName(context, shape) + "_event";
    }

    public void generateEventUnmarshaller(
        GenerationContext context,
        StructureShape event,
        Set<StructureShape> errorShapesToDeserialize,
        Set<Shape> eventShapesToDeserialize,
        boolean isErrorCodeInBody,
        BiFunction<String, MemberShape, String> getEventHeaderOutputValue
    ) {
        String methodName = getEventDeserFunctionName(context, event);
        Symbol symbol = getSymbol(context, event);
        TypeScriptWriter writer = context.getWriter();
        writer.openBlock("const $L = async (\n"
                + "  output: any,\n"
                + "  context: __SerdeContext\n"
                + "): Promise<$T> => {", "}", methodName, symbol, () -> {
            if (event.hasTrait(ErrorTrait.class)) {
                generateErrorEventUnmarshaller(context, event, errorShapesToDeserialize, isErrorCodeInBody);
            } else {
                writer.write("let contents: $L = {} as any;", symbol.getName());
                readEventHeaders(context, event, getEventHeaderOutputValue);
                readEventBody(context, event, eventShapesToDeserialize);
                writer.write("return contents;");
            }
        });
    }

    // Writes function content that unmarshall error event with error deserializer
    private void generateErrorEventUnmarshaller(
        GenerationContext context,
        StructureShape event,
        Set<StructureShape> errorShapesToDeserialize,
        boolean isErrorCodeInBody
    ) {
        TypeScriptWriter writer = context.getWriter();
        // If this is an error event, we need to generate the error deserializer.
        errorShapesToDeserialize.add(event);
        String errorDeserMethodName = getDeserFunctionName(context, event) + "Response";
        if (isErrorCodeInBody) {
            // If error code is in body, parseBody() won't be called inside error deser. So we parse body here.
            // It's ok to parse body here because body won't be streaming if 'isErrorCodeInBody' is set.
            writer.openBlock("const parsedOutput: any = {", "};",
                    () -> {
                        writer.write("...output,");
                        writer.write("body: await parseBody(output.body, context)");
                    });
            writer.write("return $L(parsedOutput, context);", errorDeserMethodName);
        } else {
            writer.write("return $L(output, context);", errorDeserMethodName);
        }
    }

    // Parse members from event headers.
    private void readEventHeaders(
        GenerationContext context,
        StructureShape event,
        BiFunction<String, MemberShape, String> getEventHeaderOutputValue
    ) {
        TypeScriptWriter writer = context.getWriter();
        List<MemberShape> headerMembers = event.getAllMembers().values().stream()
                .filter(member -> member.hasTrait(EventHeaderTrait.class)).collect(Collectors.toList());
        for (MemberShape headerMember : headerMembers) {
            String memberName = headerMember.getMemberName();
            writer.openBlock("if (output.headers[$S] !== undefined) {", "}", memberName, () -> {
                String headerValue = getEventHeaderOutputValue.apply(
                        "output.headers['" + memberName + "']", headerMember);
                writer.write("contents.$L = $L;", memberName, headerValue);
            });
        }
    }

    private void readEventBody(
        GenerationContext context,
        StructureShape event,
        Set<Shape> eventShapesToDeserialize
    ) {
        TypeScriptWriter writer = context.getWriter();
        Shape payloadShape = getEventPayloadShape(context, event);
        if (payloadShape instanceof BlobShape) {
            // Since event itself must be a structure shape, so blob payload member must has eventPayload
            // trait explicitly.
            MemberShape payloadMember = event.getAllMembers().values().stream()
                    .filter(member -> member.hasTrait(EventPayloadTrait.class))
                    .collect(Collectors.toList()).get(0);
            writer.write("contents.$L = output.body;", payloadMember.getMemberName());
        } else if (payloadShape instanceof StringShape) {
            // Since event itself must be a structure shape, so string payload member must has eventPayload
            // trait explicitly.
            MemberShape payloadMember = event.getAllMembers().values().stream()
                    .filter(member -> member.hasTrait(EventPayloadTrait.class))
                    .collect(Collectors.toList()).get(0);
            writer.write("contents.$L = await collectBodyString(output.body, context);", payloadMember.getMemberName());
        } else if (payloadShape instanceof StructureShape || payloadShape instanceof UnionShape) {
            // If body is Structure or Union, they we need to parse the string into JavaScript object.
            writer.write("const data: any = await parseBody(output.body, context);");
            Symbol symbol = getSymbol(context, payloadShape);
            String deserFunctionName = ProtocolGenerator.getDeserFunctionName(symbol, context.getProtocolName());
            writer.write("contents = {...contents, ...$L(data, context)};", deserFunctionName);
            eventShapesToDeserialize.add(payloadShape);
        }
    }
}
