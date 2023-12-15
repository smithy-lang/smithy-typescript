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
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
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
import software.amazon.smithy.typescript.codegen.knowledge.SerdeElisionIndex;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Evnetstream code generator.
 */
@SmithyUnstableApi
public class EventStreamGenerator {
    public static boolean isEventStreamShape(Shape shape) {
        return shape instanceof UnionShape && shape.hasTrait(StreamingTrait.class);
    }

    public static boolean hasEventStreamInput(GenerationContext context, OperationShape operation) {
        Model model = context.getModel();
        EventStreamIndex eventStreamIndex = EventStreamIndex.of(model);
        return eventStreamIndex.getInputInfo(operation).isPresent();
    }

    public static UnionShape getEventStreamInputShape(GenerationContext context, OperationShape operation) {
        Model model = context.getModel();
        EventStreamIndex eventStreamIndex = EventStreamIndex.of(model);
        EventStreamInfo eventStreamInfo = eventStreamIndex.getInputInfo(operation).get();
        return eventStreamInfo.getEventStreamTarget().asUnionShape().get();
    }

    public static boolean hasEventStreamOutput(GenerationContext context, OperationShape operation) {
        Model model = context.getModel();
        EventStreamIndex eventStreamIndex = EventStreamIndex.of(model);
        return eventStreamIndex.getOutputInfo(operation).isPresent();
    }

    public static UnionShape getEventStreamOutputShape(GenerationContext context, OperationShape operation) {
        Model model = context.getModel();
        EventStreamIndex eventStreamIndex = EventStreamIndex.of(model);
        EventStreamInfo eventStreamInfo = eventStreamIndex.getOutputInfo(operation).get();
        return eventStreamInfo.getEventStreamTarget().asUnionShape().get();
    }

    /**
     * Generate eventstream serializers, and related serializers for events.
     * @param context Code generation context instance.
     * @param service The service shape.
     * @param documentContentType The default content-type value of current protocol.
     * @param serializeInputEventDocumentPayload Function writes the code needed to serialize an event payload as a
     *                                          protocol-specific document.
     * @param documentShapesToSerialize The set of shapes that needs to be serialized as document payload.
     *                                  Shapes that referred by event will be added.
     */
    public void generateEventStreamSerializers(
        GenerationContext context,
        ServiceShape service,
        String documentContentType,
        Runnable serializeInputEventDocumentPayload,
        Set<Shape> documentShapesToSerialize
    ) {
        Model model = context.getModel();

        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> operations = topDownIndex.getContainedOperations(service);
        TreeSet<UnionShape> eventUnionsToSerialize = new TreeSet<>();
        TreeSet<StructureShape> eventShapesToMarshall = new TreeSet<>();
        for (OperationShape operation : operations) {
            if (hasEventStreamInput(context, operation)) {
                UnionShape eventsUnion = getEventStreamInputShape(context, operation);
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
        SerdeElisionIndex serdeElisionIndex = SerdeElisionIndex.of(model);
        eventShapesToMarshall.forEach(event -> {
            generateEventMarshaller(
                context,
                event,
                documentContentType,
                serializeInputEventDocumentPayload,
                documentShapesToSerialize,
                serdeElisionIndex);
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
     */
    public void generateEventStreamDeserializers(
        GenerationContext context,
        ServiceShape service,
        Set<StructureShape> errorShapesToDeserialize,
        Set<Shape> eventShapesToDeserialize,
        boolean isErrorCodeInBody,
        boolean serdeElisionEnabled,
        SerdeElisionIndex serdeElisionIndex
    ) {
        Model model = context.getModel();

        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> operations = topDownIndex.getContainedOperations(service);
        TreeSet<UnionShape> eventUnionsToDeserialize = new TreeSet<>();
        TreeSet<StructureShape> eventShapesToUnmarshall = new TreeSet<>();
        for (OperationShape operation : operations) {
            if (hasEventStreamOutput(context, operation)) {
                UnionShape eventsUnion = getEventStreamOutputShape(context, operation);
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
                serdeElisionEnabled,
                serdeElisionIndex
            );
        });
    }

    private void generateEventStreamSerializer(GenerationContext context, UnionShape eventsUnion) {
        String methodName = getSerFunctionName(context, eventsUnion);
        String methodLongName = ProtocolGenerator.getSerFunctionName(getSymbol(context, eventsUnion),
                context.getProtocolName());
        Symbol eventsUnionSymbol = getSymbol(context, eventsUnion);
        TypeScriptWriter writer = context.getWriter();
        Model model = context.getModel();
        writer.addImport("Message", "__Message", TypeScriptDependency.SMITHY_TYPES);

        writer.writeDocs(methodLongName);
        writer.openBlock("const $L = (\n"
                + "  input: any,\n"
                + "  context: $L\n"
                + "): any => {", "}", methodName, getEventStreamSerdeContextType(context, eventsUnion), () -> {
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
        return ProtocolGenerator.getSerFunctionShortName(symbol);
    }

    public String getEventSerFunctionName(GenerationContext context, Shape shape) {
        return getSerFunctionName(context, shape) + "_event";
    }

    private String getEventStreamSerdeContextType(GenerationContext context, UnionShape eventsUnion) {
        TypeScriptWriter writer = context.getWriter();
        writer.addImport("SerdeContext", "__SerdeContext", TypeScriptDependency.SMITHY_TYPES);
        String contextType = "__SerdeContext";
        if (eventsUnion.hasTrait(StreamingTrait.class)) {
            writer.addImport("EventStreamSerdeContext", "__EventStreamSerdeContext",
                    TypeScriptDependency.SMITHY_TYPES);
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
        Runnable serializeInputEventDocumentPayload,
        Set<Shape> documentShapesToSerialize,
        SerdeElisionIndex serdeElisionIndex
    ) {
        String methodName = getEventSerFunctionName(context, event);
        Symbol symbol = getSymbol(context, event);
        TypeScriptWriter writer = context.getWriter();
        writer.addImport("MessageHeaders", "__MessageHeaders", TypeScriptDependency.SMITHY_TYPES);
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
            writeEventHeaders(context, event);
            writeEventBody(context, event, serializeInputEventDocumentPayload,
                    documentShapesToSerialize, serdeElisionIndex);
            writer.openBlock("return { headers, body };");
        });
    }

    private void writeEventContentTypeHeader(
        GenerationContext context,
        StructureShape event,
        String documentContentType
    ) {
        TypeScriptWriter writer = context.getWriter();
        Optional<MemberShape> payloadMemberOptional = getEventPayloadMember(event);
        Shape payloadShape = payloadMemberOptional.map((member) -> {
            return context.getModel().expectShape(member.getTarget());
        }).orElse(event);
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

    private Optional<MemberShape> getEventPayloadMember(StructureShape event) {
        List<MemberShape> payloadMembers = event.getAllMembers().values().stream()
                .filter(member -> member.hasTrait(EventPayloadTrait.class))
                .collect(Collectors.toList());
        return payloadMembers.isEmpty()
                        ? Optional.empty() // implicit payload
                        : Optional.of(payloadMembers.get(0));
    }

    private void writeEventHeaders(GenerationContext context, StructureShape event) {
        TypeScriptWriter writer = context.getWriter();
        Model model = context.getModel();
        List<MemberShape> headerMembers = event.getAllMembers().values().stream()
                .filter(member -> member.hasTrait(EventHeaderTrait.class)).collect(Collectors.toList());
        for (MemberShape headerMember : headerMembers) {
            String memberName = headerMember.getMemberName();
            Shape target = model.expectShape(headerMember.getTarget());
            writer.openBlock("if (input.$L) {", "}", memberName, () -> {
                writer.write("headers[$1S] = { type: $2S, value: input.$1L }", memberName,
                        getEventHeaderType(headerMember));
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

    /**
     * If the event has a member that has an explicit eventPayload trait, return the member.
     */
    private MemberShape getExplicitEventPayloadMember(StructureShape event) {
        return event.getAllMembers().values().stream()
                    .filter(member -> member.hasTrait(EventPayloadTrait.class))
                    .collect(Collectors.toList()).get(0);
    }

    private void writeEventBody(
        GenerationContext context,
        StructureShape event,
        Runnable serializeInputEventDocumentPayload,
        Set<Shape> documentShapesToSerialize,
        SerdeElisionIndex serdeElisionIndex
    ) {
        TypeScriptWriter writer = context.getWriter();
        Optional<MemberShape> payloadMemberOptional = getEventPayloadMember(event);
        writer.write("let body = new Uint8Array();");
        if (payloadMemberOptional.isPresent()) {
            Shape payloadShape = context.getModel().expectShape(payloadMemberOptional.get().getTarget());
            String payloadMemberName = payloadMemberOptional.get().getMemberName();
            writer.openBlock("if (input.$L != null) {", "}", payloadMemberName, () -> {
                if (payloadShape instanceof BlobShape) {
                    writer.write("body = input.$L;", payloadMemberName);
                } else if (payloadShape instanceof StringShape) {
                    writer.write("body = context.utf8Decoder(input.$L);", payloadMemberName);
                } else if (payloadShape instanceof BlobShape || payloadShape instanceof StringShape) {
                    Symbol symbol = getSymbol(context, payloadShape);
                    String serFunctionName = ProtocolGenerator.getSerFunctionShortName(symbol);
                    boolean mayElide = serdeElisionIndex.mayElide(payloadShape);
                    documentShapesToSerialize.add(payloadShape);
                    if (mayElide) {
                        writer.write("body = $L(input.$L);", "_json", payloadMemberName);
                    } else {
                        writer.write("body = $L(input.$L, context);", serFunctionName, payloadMemberName);
                    }
                    serializeInputEventDocumentPayload.run();
                } else {
                    throw new CodegenException(String.format("Unexpected shape type bound to event payload: `%s`",
                        payloadShape.getType()));
                }
            });
        } else {
            // remove the input parameters that already serialized into event headers
            for (MemberShape memberShape : event.members()) {
                if (memberShape.hasTrait(EventHeaderTrait.class)) {
                    writer.write("delete input[$S]", memberShape.getMemberName());
                }
            }
            Symbol symbol = getSymbol(context, event);
            String serFunctionName = ProtocolGenerator.getSerFunctionShortName(symbol);
            documentShapesToSerialize.add(event);
            boolean mayElide = serdeElisionIndex.mayElide(event);
            if (mayElide) {
               writer.write("body = $L(input);", "_json");
            } else {
                writer.write("body = $L(input, context);", serFunctionName);
            }
            serializeInputEventDocumentPayload.run();
        }
    }

    private void generateEventStreamDeserializer(GenerationContext context, UnionShape eventsUnion) {
        String methodName = getDeserFunctionName(context, eventsUnion);
        String methodLongName = ProtocolGenerator.getDeserFunctionName(getSymbol(context, eventsUnion),
                context.getProtocolName());
        Symbol eventsUnionSymbol = getSymbol(context, eventsUnion);
        TypeScriptWriter writer = context.getWriter();
        Model model = context.getModel();
        String contextType = getEventStreamSerdeContextType(context, eventsUnion);

        writer.writeDocs(methodLongName);
        writer.openBlock("const $L = (\n"
                + "  output: any,\n"
                + "  context: $L\n"
                + "): AsyncIterable<$T> => {", "}", methodName, contextType, eventsUnionSymbol, () -> {
            writer.openBlock("return context.eventStreamMarshaller.deserialize(", ");", () -> {
                writer.write("output,");
                writer.openBlock("async event => {", "}", () -> {
                    eventsUnion.getAllMembers().forEach((name, member) -> {
                        StructureShape event = model.expectShape(member.getTarget(), StructureShape.class);
                        writer.openBlock("if (event[$S] != null) {", "}", name, () -> {
                            writer.openBlock("return {", "};", () -> {
                                String eventDeserMethodName = getEventDeserFunctionName(context, event);
                                writer.write("$1L: await $2L(event[$1S], context),", name, eventDeserMethodName);
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
        return ProtocolGenerator.getDeserFunctionShortName(symbol);
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
        boolean serdeElisionEnabled,
        SerdeElisionIndex serdeElisionIndex
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
                writer.write("const contents: $L = {} as any;", symbol.getName());
                readEventHeaders(context, event);
                readEventBody(context, event, eventShapesToDeserialize, serdeElisionEnabled, serdeElisionIndex);
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
        String errorDeserMethodName = getDeserFunctionName(context, event) + "Res";
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
    private void readEventHeaders(GenerationContext context, StructureShape event) {
        TypeScriptWriter writer = context.getWriter();
        List<MemberShape> headerMembers = event.getAllMembers().values().stream()
                .filter(member -> member.hasTrait(EventHeaderTrait.class)).toList();
        for (MemberShape headerMember : headerMembers) {
            String memberName = headerMember.getMemberName();
            String varName = context.getStringStore().var(memberName);

            writer.write(
                """
                if (output.headers[$1L] !== undefined) {
                    contents[$1L] = output.headers[$1L].value;
                }
                """,
                varName
            );
        }
    }

    private void readEventBody(
        GenerationContext context,
        StructureShape event,
        Set<Shape> eventShapesToDeserialize,
        boolean serdeElisionEnabled,
        SerdeElisionIndex serdeElisionIndex
    ) {
        TypeScriptWriter writer = context.getWriter();
        Optional<MemberShape> payloadmemberOptional = getEventPayloadMember(event);
        if (payloadmemberOptional.isPresent()) {
            Shape payloadShape = context.getModel().expectShape(payloadmemberOptional.get().getTarget());
            String payloadMemberName = payloadmemberOptional.get().getMemberName();
            if (payloadShape instanceof BlobShape) {
                writer.write("contents.$L = output.body;", payloadMemberName);
            } else if (payloadShape instanceof StringShape) {
                writer.write("contents.$L = await collectBodyString(output.body, context);", payloadMemberName);
            } else if (payloadShape instanceof StructureShape || payloadShape instanceof UnionShape) {
                writer.write("const data: any = await parseBody(output.body, context);");
                Symbol symbol = getSymbol(context, payloadShape);
                String deserFunctionName = ProtocolGenerator.getDeserFunctionShortName(symbol);
                boolean mayElide = serdeElisionEnabled && serdeElisionIndex.mayElide(payloadShape);
                if (mayElide) {
                    writer.addImport("_json", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
                    writer.write("contents.$L = $L(data);", payloadMemberName, "_json");
                } else {
                    writer.write("contents.$L = $L(data, context);", payloadMemberName, deserFunctionName);
                }
                eventShapesToDeserialize.add(payloadShape);
            }
        } else {
            writer.write("const data: any = await parseBody(output.body, context);");
            Symbol symbol = getSymbol(context, event);
            String deserFunctionName = ProtocolGenerator.getDeserFunctionShortName(symbol);
            boolean mayElide = serdeElisionEnabled && serdeElisionIndex.mayElide(event);
            if (mayElide) {
                writer.addImport("_json", null, TypeScriptDependency.AWS_SMITHY_CLIENT);
                writer.write("Object.assign(contents, $L(data));", "_json");
            } else {
                writer.write("Object.assign(contents, $L(data, context));", deserFunctionName);
            }
            eventShapesToDeserialize.add(event);
        }
    }
}
