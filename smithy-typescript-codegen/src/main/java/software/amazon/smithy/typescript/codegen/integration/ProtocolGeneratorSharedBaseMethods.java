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
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.HttpBinding;
import software.amazon.smithy.model.knowledge.HttpBindingIndex;
import software.amazon.smithy.model.shapes.BlobShape;
import software.amazon.smithy.model.shapes.BooleanShape;
import software.amazon.smithy.model.shapes.CollectionShape;
import software.amazon.smithy.model.shapes.DocumentShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.NumberShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.StringShape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.shapes.TimestampShape;
import software.amazon.smithy.model.shapes.UnionShape;
import software.amazon.smithy.model.traits.EventHeaderTrait;
import software.amazon.smithy.model.traits.EventPayloadTrait;
import software.amazon.smithy.model.traits.MediaTypeTrait;
import software.amazon.smithy.model.traits.TimestampFormatTrait;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;

public abstract class ProtocolGeneratorSharedBaseMethods implements ProtocolGenerator {
    protected final Set<Shape> serializationDocumentShapes = new TreeSet<>();
    protected final Set<Shape> deserializationDocumentShapes = new TreeSet<>();
    protected final Set<StructureShape> serializationErrorShapes = new TreeSet<>();
    protected final Set<StructureShape> deserializationErrorShapes = new TreeSet<>();
    protected final Set<StructureShape> serializationEventShapes = new TreeSet<>();
    protected final Set<StructureShape> deserializationEventShapes = new TreeSet<>();
    protected final Set<UnionShape> serializationEventUnions = new TreeSet<>();
    protected final Set<UnionShape> deserializationEventUnions = new TreeSet<>();

    // Parse members from event headers.
    protected void readEventHeaders(ProtocolGenerator.GenerationContext context, StructureShape event) {
        TypeScriptWriter writer = context.getWriter();
        Model model = context.getModel();
        List<MemberShape> headerMembers = event.getAllMembers().values().stream()
            .filter(member -> member.hasTrait(EventHeaderTrait.class)).collect(Collectors.toList());
        for (MemberShape headerMember : headerMembers) {
            String memberName = headerMember.getMemberName();
            writer.openBlock("if (output.headers[$S] !== undefined) {", "}", memberName, () -> {
                Shape target = model.expectShape(headerMember.getTarget());
                String headerValue = getOutputValue(context, HttpBinding.Location.HEADER,
                    "output.headers['" + memberName + "']", headerMember, target);
                writer.write("contents.$L = $L;", memberName, headerValue);
            });
        }
    }

    protected void readEventBody(ProtocolGenerator.GenerationContext context, StructureShape event) {
        TypeScriptWriter writer = context.getWriter();
        // Parse members from event payload.
        List<MemberShape> payloadMembers = event.getAllMembers().values().stream()
            .filter(member -> member.hasTrait(EventPayloadTrait.class)).collect(Collectors.toList());
        List<MemberShape> documentMembers = event.getAllMembers().values().stream()
            .filter(member -> !member.hasTrait(EventHeaderTrait.class)
                && !member.hasTrait(EventPayloadTrait.class))
            .collect(Collectors.toList());
        if (!payloadMembers.isEmpty()) {
            //There's only one event payload member
            MemberShape payloadMember = payloadMembers.get(0);
            readEventPayload(context, payloadMember);
        } else if (!documentMembers.isEmpty()) {
            // Parse member from event body using original event structure deser.
            SymbolProvider symbolProvider = context.getSymbolProvider();
            Symbol symbol = symbolProvider.toSymbol(event);
            // If response has document binding, the body can be parsed to JavaScript object.
            writer.write("const data: any = await parseBody(output.body, context);");
            // Deser the event document with the original event(structure) shape deser function
            writer.openBlock("contents = {", "} as any;", () -> {
                writer.write("...contents,");
                writer.write("...$L(data, context)",
                    ProtocolGenerator.getDeserFunctionName(symbol, context.getProtocolName()));
            });
            //need original structure shape deserializer to deserialize event body.
            deserializationDocumentShapes.add(event);
        }
    }

    protected void readEventPayload(ProtocolGenerator.GenerationContext context, MemberShape payloadMember) {
        TypeScriptWriter writer = context.getWriter();
        Model model = context.getModel();
        Shape payloadTarget = model.expectShape(payloadMember.getTarget());
        String memberName = payloadMember.getMemberName();
        if (payloadTarget instanceof BlobShape) {
            // If event payload is a blob, only need to collect stream to binary data(Uint8Array).
            writer.write("contents.$L = output.body;", memberName);
        } else if (payloadTarget instanceof StructureShape || payloadTarget instanceof UnionShape) {
            // If body is Structure or Union, then we need to parse the string into JavaScript object.
            writer.write("contents.$L = await parseBody(output.body, context);", memberName);
        } else if (payloadTarget instanceof StringShape) {
            // If payload is string, we need to collect body and encode binary to string.
            writer.write("contents.$L = await collectBodyString(output.body, context);", memberName);
        } else {
            throw new CodegenException(String.format("Unexpected shape type bound to event payload: `%s`",
                payloadTarget.getType()));
        }
    }

    /**
     * Given context and a source of data, generate an output value provider for the
     * shape. This may use native types (like generating a Date for timestamps,)
     * converters (like a base64Decoder,) or invoke complex type deserializers to
     * manipulate the dataSource into the proper output content.
     *
     * @param context The generation context.
     * @param bindingType How this value is bound to the operation output.
     * @param dataSource The in-code location of the data to provide an output of
     *                   ({@code output.foo}, {@code entry}, etc.)
     * @param member The member that points to the value being provided.
     * @param target The shape of the value being provided.
     * @return Returns a value or expression of the output value.
     */
    protected String getOutputValue(
        ProtocolGenerator.GenerationContext context,
        HttpBinding.Location bindingType,
        String dataSource,
        MemberShape member,
        Shape target
    ) {
        if (target instanceof NumberShape) {
            return getNumberOutputParam(context, bindingType, dataSource, target);
        } else if (target instanceof BooleanShape) {
            return getBooleanOutputParam(context, bindingType, dataSource);
        } else if (target instanceof StringShape) {
            return getStringOutputParam(context, bindingType, dataSource, target);
        } else if (target instanceof DocumentShape) {
            return dataSource;
        } else if (target instanceof TimestampShape) {
            HttpBindingIndex httpIndex = HttpBindingIndex.of(context.getModel());
            TimestampFormatTrait.Format format = httpIndex.determineTimestampFormat(
                member, bindingType,
                getDocumentTimestampFormat()
            );
            return HttpProtocolGeneratorUtils.getTimestampOutputParam(
                context.getWriter(), dataSource, bindingType, member, format,
                requiresNumericEpochSecondsInPayload()
            );
        } else if (target instanceof BlobShape) {
            return getBlobOutputParam(bindingType, dataSource);
        } else if (target instanceof CollectionShape) {
            return getCollectionOutputParam(context, bindingType, dataSource, (CollectionShape) target);
        } else if (target instanceof StructureShape || target instanceof UnionShape) {
            return getNamedMembersOutputParam(context, bindingType, dataSource, target);
        }

        throw new CodegenException(String.format(
            "Unsupported %s binding of %s to %s in %s using the %s protocol",
            bindingType, member.getMemberName(), target.getType(), member.getContainer(), getName()));
    }


    /**
     * Given context and a source of data, generate an output value provider for the
     * boolean. By default, this checks strict equality to 'true' in headers and passes
     * through for documents.
     *
     * @param bindingType How this value is bound to the operation output.
     * @param dataSource The in-code location of the data to provide an output of
     *                   ({@code output.foo}, {@code entry}, etc.)
     * @return Returns a value or expression of the output boolean.
     */
    protected String getBooleanOutputParam(ProtocolGenerator.GenerationContext context,
                                           HttpBinding.Location bindingType,
                                           String dataSource) {
        switch (bindingType) {
            case QUERY:
            case LABEL:
            case HEADER:
                context.getWriter().addImport("parseBoolean", "__parseBoolean", "@aws-sdk/smithy-client");
                return String.format("__parseBoolean(%s)", dataSource);
            default:
                throw new CodegenException("Unexpected boolean binding location `" + bindingType + "`");
        }
    }

    /**
     * Given context and a source of data, generate an output value provider for the
     * string. By default, this base64 decodes content in headers if there is a
     * mediaType applied to the string, and passes through for all other cases.
     *
     * @param context The generation context.
     * @param bindingType How this value is bound to the operation input.
     * @param dataSource The in-code location of the data to provide an input of
     *                   ({@code input.foo}, {@code entry}, etc.)
     * @param target The shape of the value being provided.
     * @return Returns a value or expression of the input string.
     */
    protected String getStringOutputParam(
        ProtocolGenerator.GenerationContext context,
        HttpBinding.Location bindingType,
        String dataSource,
        Shape target
    ) {
        // Decode these to base64 if a MediaType is present.
        if (bindingType == HttpBinding.Location.HEADER && target.hasTrait(MediaTypeTrait.ID)) {
            dataSource = "Buffer.from(context.base64Decoder(" + dataSource + ")).toString('utf8')";
        }

        return HttpProtocolGeneratorUtils.getStringOutputParam(
            context, target, dataSource, !isGuaranteedString(bindingType));
    }

    protected boolean isGuaranteedString(HttpBinding.Location bindingType) {
        return bindingType != HttpBinding.Location.PAYLOAD && bindingType != HttpBinding.Location.DOCUMENT;
    }

    /**
     * Given context and a source of data, generate an output value provider for the
     * blob. By default, this base64 decodes content in headers and passes through
     * for payloads.
     *
     * @param bindingType How this value is bound to the operation output.
     * @param dataSource The in-code location of the data to provide an output of
     *                   ({@code output.foo}, {@code entry}, etc.)
     * @return Returns a value or expression of the output blob.
     */
    protected String getBlobOutputParam(HttpBinding.Location bindingType, String dataSource) {
        switch (bindingType) {
            case PAYLOAD:
                return dataSource;
            case QUERY:
            case LABEL:
            case HEADER:
                // Decode these from base64.
                return "context.base64Decoder(" + dataSource + ")";
            default:
                throw new CodegenException("Unexpected blob binding location `" + bindingType + "`");
        }
    }

    /**
     * Given context and a source of data, generate an output value provider for the
     * collection. By default, this splits a comma separated string in headers.
     *
     * @param context The generation context.
     * @param bindingType How this value is bound to the operation output.
     * @param dataSource The in-code location of the data to provide an output of
     *                   ({@code output.foo}, {@code entry}, etc.)
     * @param target The shape of the value being provided.
     * @return Returns a value or expression of the output collection.
     */
    protected String getCollectionOutputParam(
        ProtocolGenerator.GenerationContext context,
        HttpBinding.Location bindingType,
        String dataSource,
        CollectionShape target
    ) {
        MemberShape targetMember = target.getMember();
        Shape collectionTarget = context.getModel().expectShape(targetMember.getTarget());
        String collectionTargetValue = getOutputValue(context, bindingType, "_entry.trim()",
            targetMember, collectionTarget);
        String outputParam;
        switch (bindingType) {
            case QUERY_PARAMS:
            case QUERY:
                return String.format("%1$s.map(_entry => %2$s as any)",
                    dataSource, collectionTargetValue);
            case LABEL:
                dataSource = "(" + dataSource + " || \"\")";
                // Split these values on slashes.
                outputParam = "" + dataSource + ".split('/')";

                // Iterate over each entry and do deser work.
                outputParam += ".map(_entry => " + collectionTargetValue + " as any)";

                return outputParam;
            case HEADER:
                dataSource = "(" + dataSource + " || \"\")";
                // Split these values on commas.
                outputParam = "" + dataSource + ".split(',')";

                // Headers that have HTTP_DATE formatted timestamps already contain a ","
                // in their formatted entry, so split on every other "," instead.
                if (collectionTarget.isTimestampShape()) {
                    // Check if our member resolves to the HTTP_DATE format.
                    HttpBindingIndex httpIndex = HttpBindingIndex.of(context.getModel());
                    TimestampFormatTrait.Format format =
                        httpIndex.determineTimestampFormat(
                            targetMember,
                            bindingType,
                            TimestampFormatTrait.Format.HTTP_DATE
                        );

                    if (format == TimestampFormatTrait.Format.HTTP_DATE) {
                        TypeScriptWriter writer = context.getWriter();
                        writer.addImport("splitEvery", "__splitEvery", "@aws-sdk/smithy-client");
                        outputParam = "__splitEvery(" + dataSource + ", ',', 2)";
                    }
                }

                // Iterate over each entry and do deser work.
                outputParam += ".map(_entry => " + collectionTargetValue + " as any)";

                return outputParam;
            default:
                throw new CodegenException("Unexpected collection binding location `" + bindingType + "`");
        }
    }

    /**
     * Given context and a source of data, generate an output value provider for the
     * shape. This redirects to a deserialization function for documents and payloads,
     * and fails otherwise.
     *
     * @param context The generation context.
     * @param bindingType How this value is bound to the operation output.
     * @param dataSource The in-code location of the data to provide an output of
     *                   ({@code output.foo}, {@code entry}, etc.)
     * @param target The shape of the value being provided.
     * @return Returns a value or expression of the output shape.
     */
    protected String getNamedMembersOutputParam(
        ProtocolGenerator.GenerationContext context,
        HttpBinding.Location bindingType,
        String dataSource,
        Shape target
    ) {
        switch (bindingType) {
            case PAYLOAD:
                // Redirect to a deserialization function.
                Symbol symbol = context.getSymbolProvider().toSymbol(target);
                return ProtocolGenerator.getDeserFunctionName(symbol, context.getProtocolName())
                    + "(" + dataSource + ", context)";
            default:
                throw new CodegenException("Unexpected named member shape binding location `" + bindingType + "`");
        }
    }

    /**
     * Given context and a source of data, generate an output value provider for the
     * number. By default, invokes parseInt on byte/short/integer/long types in headers,
     * invokes parseFloat on float/double types in headers, and fails otherwise.
     *
     * @param bindingType How this value is bound to the operation output.
     * @param dataSource The in-code location of the data to provide an output of
     *                   ({@code output.foo}, {@code entry}, etc.)
     * @param target The shape of the value being provided.
     * @return Returns a value or expression of the output number.
     */
    protected String getNumberOutputParam(
        ProtocolGenerator.GenerationContext context,
        HttpBinding.Location bindingType,
        String dataSource,
        Shape target
    ) {
        switch (bindingType) {
            case QUERY:
            case LABEL:
            case HEADER:
                switch (target.getType()) {
                    case DOUBLE:
                        context.getWriter().addImport(
                            "strictParseDouble", "__strictParseDouble", "@aws-sdk/smithy-client");
                        return "__strictParseDouble(" + dataSource + ")";
                    case FLOAT:
                        context.getWriter().addImport(
                            "strictParseFloat", "__strictParseFloat", "@aws-sdk/smithy-client");
                        return "__strictParseFloat(" + dataSource + ")";
                    case LONG:
                        context.getWriter().addImport(
                            "strictParseLong", "__strictParseLong", "@aws-sdk/smithy-client");
                        return "__strictParseLong(" + dataSource + ")";
                    case INTEGER:
                        context.getWriter().addImport(
                            "strictParseInt32", "__strictParseInt32", "@aws-sdk/smithy-client");
                        return "__strictParseInt32(" + dataSource + ")";
                    case SHORT:
                        context.getWriter().addImport(
                            "strictParseShort", "__strictParseShort", "@aws-sdk/smithy-client");
                        return "__strictParseShort(" + dataSource + ")";
                    case BYTE:
                        context.getWriter().addImport(
                            "strictParseByte", "__strictParseByte", "@aws-sdk/smithy-client");
                        return "__strictParseByte(" + dataSource + ")";
                    default:
                        throw new CodegenException("Unexpected number shape `" + target.getType() + "`");
                }
            default:
                throw new CodegenException("Unexpected number binding location `" + bindingType + "`");
        }
    }

    /**
     * @return true if this protocol disallows string epoch timestamps in payloads.
     */
    protected boolean requiresNumericEpochSecondsInPayload() {
        return true;
    }

    /**
     * Gets the default serde format for timestamps.
     *
     * @return Returns the default format.
     */
    protected TimestampFormatTrait.Format getDocumentTimestampFormat() {
        return TimestampFormatTrait.Format.EPOCH_SECONDS;
    }
}
