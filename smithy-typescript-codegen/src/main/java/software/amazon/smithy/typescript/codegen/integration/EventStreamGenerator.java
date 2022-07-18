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
import software.amazon.smithy.model.traits.EventHeaderTrait;
import software.amazon.smithy.model.traits.EventPayloadTrait;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator.GenerationContext;
import software.amazon.smithy.utils.SmithyUnstableApi;

@SmithyUnstableApi
public class EventStreamGenerator {
    public void generateEventStreamSerializers(
        GenerationContext context,
        ServiceShape service,
        String documentContentType,
        BiFunction<String, MemberShape, String> getEventHeaderInputValue,
        BiFunction<String, MemberShape, String> getEventPayloadInputValue,
        Consumer<GenerationContext> serializeInputEventDocumentPayload
    ) {
        Model model = context.getModel();

        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> operations = topDownIndex.getContainedOperations(service);
        EventStreamIndex eventStreamIndex = EventStreamIndex.of(model);
        TreeSet<StructureShape> eventShapesToMarshall = new TreeSet<>();
        TreeSet<StructureShape> eventShapesToUnmarshall = new TreeSet<>();
        for (OperationShape operation : operations) {
            if (eventStreamIndex.getInputInfo(operation).isPresent()) {
                EventStreamInfo eventStreamInfo = eventStreamIndex.getInputInfo(operation).get();
                UnionShape eventsUnion = eventStreamInfo.getEventStreamTarget().asUnionShape().get();
                generateEventStreamSerializer(context, eventsUnion);
                Set<StructureShape> eventShapes = eventsUnion.members().stream()
                        .map(member -> model.expectShape(member.getTarget()).asStructureShape().get())
                        .collect(Collectors.toSet());
                eventShapes.forEach(eventShapesToMarshall::add);
            } else if (eventStreamIndex.getOutputInfo(operation).isPresent()) {
                EventStreamInfo eventStreamInfo = eventStreamIndex.getOutputInfo(operation).get();
                UnionShape eventsUnion = eventStreamInfo.getEventStreamTarget().asUnionShape().get();
                // generateEventStreamSerializer(context, eventsUnion);
                Set<StructureShape> eventShapes = eventsUnion.members().stream()
                        .map(member -> model.expectShape(member.getTarget()).asStructureShape().get())
                        .collect(Collectors.toSet());
                eventShapes.forEach(eventShapesToUnmarshall::add);
            }
        }

        eventShapesToMarshall.forEach(event -> {
            generateEventMarshaller(
                context,
                event,
                documentContentType,
                getEventHeaderInputValue,
                getEventPayloadInputValue,
                serializeInputEventDocumentPayload);
        });
        eventShapesToUnmarshall.forEach(event -> {
            //PASS
        });
    }

    private void generateEventStreamSerializer(GenerationContext context, UnionShape eventsUnion) {
        String methodName = getEventStreamFunctionName(context, eventsUnion);
        Symbol eventsUnionSymbol = getSymbol(context, eventsUnion);
        TypeScriptWriter writer = context.getWriter();
        Model model = context.getModel();
        writer.addImport("Message", "__Message", TypeScriptDependency.AWS_SDK_TYPES.packageName);
        writer.openBlock("const $L = (\n"
                + "  input: any,\n"
                + "  context: __SerdeContext\n"
                + "): any => {", "}", methodName, () -> {
            writer.openBlock("const eventMarshallingVisitor = (event: any): __Message => $T.visit(event, {", "});",
                    eventsUnionSymbol, () -> {
                        eventsUnion.getAllMembers().forEach((memberName, memberShape) -> {
                            StructureShape target = model.expectShape(memberShape.getTarget(), StructureShape.class);
                            String eventSerMethodName = getEventStreamFunctionName(context, target);
                            writer.write("$L: value => $L(value, context)", memberName, eventSerMethodName);
                        });
                        writer.write("_: value => value as any");
                    });
            writer.write("return context.eventStreamMarshaller.serialize(input, eventMarshallingVisitor);");
        });
    }

    public String getEventStreamFunctionName(GenerationContext context, Shape shape) {
        Symbol symbol = getSymbol(context, shape);
        String protocolName = context.getProtocolName();
        return ProtocolGenerator.getSerFunctionName(symbol, protocolName) + "_event";
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
        Consumer<GenerationContext> serializeInputEventDocumentPayload
    ) {
        String methodName = getEventStreamFunctionName(context, event);
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
            writeEventBody(context, event, getEventPayloadInputValue, serializeInputEventDocumentPayload);
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
        Consumer<GenerationContext> serializeInputEventDocumentPayload
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
            writer.write("message.body = $L || message.body;",
                    getEventPayloadInputValue.apply("input." + payloadMemberName, payloadMember));
        } else if (payloadShape instanceof StructureShape || payloadShape instanceof UnionShape) {
            // handle implicit event payload by removing members with eventHeader trait.
            for (MemberShape memberShape : event.members()) {
                if (memberShape.hasTrait(EventHeaderTrait.class)) {
                    writer.write("delete input[$S]", memberShape.getMemberName());
                }
            }
            SymbolProvider symbolProvider = context.getSymbolProvider();
            Symbol symbol = symbolProvider.toSymbol(payloadShape);
            String serFunctionName = ProtocolGenerator.getSerFunctionName(symbol, context.getProtocolName());
            writer.write("const body = $L(input, context);", serFunctionName);
            serializeInputEventDocumentPayload.accept(context);
        } else {
            throw new CodegenException(String.format("Unexpected shape type bound to event payload: `%s`",
                    payloadShape.getType()));
        }
    }

    private void generateEventStreamDeserializer(GenerationContext context, UnionShape eventsUnion) {

    }
}
