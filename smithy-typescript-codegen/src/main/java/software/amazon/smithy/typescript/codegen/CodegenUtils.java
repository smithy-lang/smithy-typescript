/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.EventStreamIndex;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.HttpPayloadTrait;
import software.amazon.smithy.model.traits.StreamingTrait;
import software.amazon.smithy.typescript.codegen.integration.AddSdkStreamMixinDependency;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Utility methods needed across Java packages.
 */
@SmithyUnstableApi
public final class CodegenUtils {

    public static final String SOURCE_FOLDER = "src";
    public static final String TEST_FOLDER = "test";

    private CodegenUtils() {}

    /**
     * Detects if an annotated mediatype indicates JSON contents.
     *
     * @param mediaType The media type to inspect.
     * @return If the media type indicates JSON contents.
     */
    public static boolean isJsonMediaType(String mediaType) {
        return mediaType.equals("application/json") || mediaType.endsWith("+json");
    }

    /**
     * Get context type for command serializer functions.
     * @param writer The code writer.
     * @param model The model for the service containing the given command.
     * @param operation The operation shape for given command.
     * @return The TypeScript type for the serializer context
     */
    public static String getOperationSerializerContextType(
            TypeScriptWriter writer,
            Model model,
            OperationShape operation
    ) {
        // Get default SerdeContext.
        List<String> contextInterfaceList = getDefaultOperationSerdeContextTypes(writer);
        // If event stream trait exists, add corresponding serde context type to the intersection type.
        EventStreamIndex eventStreamIndex = EventStreamIndex.of(model);
        if (eventStreamIndex.getInputInfo(operation).isPresent()) {
            writer.addTypeImport("EventStreamSerdeContext",
                    "__EventStreamSerdeContext",
                    TypeScriptDependency.SMITHY_TYPES);
            contextInterfaceList.add("__EventStreamSerdeContext");
        }
        return String.join(" & ", contextInterfaceList);
    }

    /**
     * Get context type for command deserializer function.
     * @param settings The TypeScript settings
     * @param writer The code writer.
     * @param model The model for the service containing the given command.
     * @param operation The operation shape for given command.
     * @return The TypeScript type for the deserializer context
     */
    public static String getOperationDeserializerContextType(
            TypeScriptSettings settings,
            TypeScriptWriter writer,
            Model model,
            OperationShape operation
    ) {
        // Get default SerdeContext.
        List<String> contextInterfaceList = getDefaultOperationSerdeContextTypes(writer);
        // If event stream trait exists, add corresponding serde context type to the intersection type.
        EventStreamIndex eventStreamIndex = EventStreamIndex.of(model);
        if (eventStreamIndex.getOutputInfo(operation).isPresent()) {
            writer.addTypeImport("EventStreamSerdeContext",
                    "__EventStreamSerdeContext",
                    TypeScriptDependency.SMITHY_TYPES);
            contextInterfaceList.add("__EventStreamSerdeContext");
        }
        if (AddSdkStreamMixinDependency.hasStreamingBlobDeser(settings, model, operation)) {
            writer.addTypeImport("SdkStreamSerdeContext",
                    "__SdkStreamSerdeContext",
                    TypeScriptDependency.SMITHY_TYPES);
            contextInterfaceList.add("__SdkStreamSerdeContext");
        }
        return String.join(" & ", contextInterfaceList);
    }

    private static List<String> getDefaultOperationSerdeContextTypes(TypeScriptWriter writer) {
        List<String> contextInterfaceList = new ArrayList<>();
        // Get default SerdeContext.
        writer.addTypeImport("SerdeContext", "__SerdeContext", TypeScriptDependency.SMITHY_TYPES);
        contextInterfaceList.add("__SerdeContext");
        return contextInterfaceList;
    }

    static List<MemberShape> getBlobStreamingMembers(Model model, StructureShape shape) {
        return shape.getAllMembers()
                .values()
                .stream()
                .filter(memberShape -> {
                    // Streaming blobs need to have their types modified
                    // See `writeClientCommandStreamingInputType`
                    Shape target = model.expectShape(memberShape.getTarget());
                    return target.isBlobShape() && target.hasTrait(StreamingTrait.class);
                })
                .collect(Collectors.toList());
    }

    /**
     * Generate the type of the command input of the client sdk given the streaming blob
     * member of the shape. The generated type eases the streaming member requirement so that users don't need to
     * construct a stream every time.
     * This type decoration is allowed in Smithy because it makes, for the same member, the type to be serialized is
     * more permissive than the type to be deserialized.
     * Refer here for more rationales: https://github.com/aws/aws-sdk-js-v3/issues/843
     */
    static void writeClientCommandStreamingInputType(
            TypeScriptWriter writer,
            Symbol containerSymbol,
            String typeName,
            MemberShape streamingMember,
            String commandName
    ) {
        writer.addTypeImport("StreamingBlobPayloadInputTypes", null, TypeScriptDependency.SMITHY_TYPES);
        String memberName = streamingMember.getMemberName();
        String optionalSuffix = streamingMember.isRequired() ? "" : "?";

        writer.writeDocs("@public\n\nThe input for {@link " + commandName + "}.");
        writer.write(
                """
                        export interface $L extends Omit<$T, $S> {
                          $L$L: StreamingBlobPayloadInputTypes;
                        }
                        """,
                typeName,
                containerSymbol,
                memberName,
                memberName,
                optionalSuffix);
    }

    /**
     * Generate the type of the command output of the client sdk given the streaming blob
     * member of the shape. The type marks the streaming blob member to contain the utility methods to transform the
     * stream to string, buffer or WHATWG stream API.
     */
    static void writeClientCommandStreamingOutputType(
            TypeScriptWriter writer,
            Symbol containerSymbol,
            String typeName,
            MemberShape streamingMember,
            String commandName
    ) {
        String memberName = streamingMember.getMemberName();
        String optionalSuffix = streamingMember.isRequired() ? "" : "?";
        writer.addTypeImport("MetadataBearer", "__MetadataBearer", TypeScriptDependency.SMITHY_TYPES);
        writer.addTypeImport("StreamingBlobPayloadOutputTypes", null, TypeScriptDependency.SMITHY_TYPES);

        writer.writeDocs("@public\n\nThe output of {@link " + commandName + "}.");
        writer.write(
                """
                        export interface $L extends Omit<$T, $S>, __MetadataBearer {
                          $L$L: StreamingBlobPayloadOutputTypes;
                        }
                        """,
                typeName,
                containerSymbol,
                memberName,
                memberName,
                optionalSuffix);
    }

    static List<MemberShape> getBlobPayloadMembers(Model model, StructureShape shape) {
        return shape.getAllMembers()
                .values()
                .stream()
                .filter(memberShape -> {
                    Shape target = model.expectShape(memberShape.getTarget());
                    return target.isBlobShape()
                            && memberShape.hasTrait(HttpPayloadTrait.class)
                            && !target.hasTrait(StreamingTrait.class);
                })
                .collect(Collectors.toList());
    }

    static void writeClientCommandBlobPayloadInputType(
            TypeScriptWriter writer,
            Symbol containerSymbol,
            String typeName,
            MemberShape payloadMember,
            String commandName
    ) {
        String memberName = payloadMember.getMemberName();
        String optionalSuffix = payloadMember.isRequired() ? "" : "?";

        writer.addTypeImport("BlobPayloadInputTypes", null, TypeScriptDependency.SMITHY_TYPES);

        writer.writeDocs("@public");
        writer.write(
                """
                        export type $LType = Omit<$T, $S> & {
                          $L: BlobPayloadInputTypes;
                        };
                        """,
                typeName,
                containerSymbol,
                memberName,
                memberName + optionalSuffix);

        writer.writeDocs("@public\n\nThe input for {@link " + commandName + "}.");
        writer.write("export interface $1L extends $1LType {}", typeName);
    }

    static void writeClientCommandBlobPayloadOutputType(
            TypeScriptWriter writer,
            Symbol containerSymbol,
            String typeName,
            MemberShape payloadMember,
            String commandName
    ) {
        String memberName = payloadMember.getMemberName();
        String optionalSuffix = payloadMember.isRequired() ? "" : "?";

        writer.addImport("Uint8ArrayBlobAdapter", null, TypeScriptDependency.UTIL_STREAM);
        writer.addDependency(TypeScriptDependency.UTIL_STREAM);

        writer.writeDocs("@public");
        writer.write(
                """
                        export type $LType = Omit<$T, $S> & {
                          $L: Uint8ArrayBlobAdapter;
                        };
                        """,
                typeName,
                containerSymbol,
                memberName,
                memberName + optionalSuffix);

        writer.writeDocs("@public\n\nThe output of {@link " + commandName + "}.");
        writer.write(
                "export interface $1L extends $1LType, __MetadataBearer {}",
                typeName);
    }

    /**
     * Returns the list of function parameter key-value pairs to be written for
     * provided parameters map.
     *
     * @param paramsMap Map of parameters to generate a parameters string for.
     * @return The list of parameters to be written.
     */
    static List<String> getFunctionParametersList(Map<String, Object> paramsMap) {
        List<String> functionParametersList = new ArrayList<String>();
        List<Map.Entry<String, Object>> sortedParamsMap = paramsMap.entrySet()
                .stream()
                .sorted(Map.Entry.comparingByKey())
                .toList();

        if (!sortedParamsMap.isEmpty()) {
            for (Map.Entry<String, Object> param : sortedParamsMap) {
                String key = param.getKey();
                Object value = param.getValue();
                if (value instanceof Symbol) {
                    String symbolName = ((Symbol) value).getName();
                    if (key.equals(symbolName)) {
                        functionParametersList.add(String.format("$%s:T", symbolName));
                    } else {
                        functionParametersList.add(String.format("%s: $%s:T", key, key));
                    }
                } else if (value instanceof String) {
                    functionParametersList.add(String.format("%s: '%s'", key, value));
                } else if (value instanceof Boolean) {
                    functionParametersList.add(String.format("%s: %s", key, value));
                } else if (value instanceof List) {
                    List<?> valueList = (List<?>) value;
                    if (!valueList.isEmpty() && !(valueList.get(0) instanceof String)) {
                        throw new CodegenException("Plugin function parameters list must be List<String>");
                    }
                    List<String> valueStringList = valueList.stream()
                            .map(item -> String.format("'%s'", item))
                            .collect(Collectors.toList());
                    functionParametersList.add(String.format("'%s': [%s]",
                            key,
                            valueStringList.stream().collect(Collectors.joining(", "))));
                } else if (value instanceof Map) {
                    Map<?, ?> valueMap = (Map<?, ?>) value;
                    if (!valueMap.isEmpty() && valueMap.keySet().stream().anyMatch(k -> !(k instanceof String))
                            && valueMap.values().stream().anyMatch(v -> !(v instanceof String))) {
                        throw new CodegenException("Plugin function parameters map must be Map<String, String>");
                    }
                    List<String> valueStringList = valueMap.entrySet()
                            .stream()
                            .map(entry -> String.format("'%s': '%s'", entry.getKey(), entry.getValue()))
                            .collect(Collectors.toList());
                    functionParametersList.add(String.format("%s: {%s}",
                            key,
                            valueStringList.stream().collect(Collectors.joining(", "))));
                } else {
                    // Future support for param type should be added in else if.
                    throw new CodegenException("Plugin function parameters not supported for type "
                            + value.getClass());
                }
            }
        }

        return functionParametersList;
    }

    /**
     * Ease the input streaming member restriction so that users don't need to construct a stream every time.
     * This is used for inline type declarations (such as parameters) that need to take more permissive inputs
     * Refer here for more rationales: https://github.com/aws/aws-sdk-js-v3/issues/843
     */
    static void writeInlineStreamingMemberType(
            TypeScriptWriter writer,
            Symbol containerSymbol,
            MemberShape streamingMember
    ) {
        String memberName = streamingMember.getMemberName();
        String optionalSuffix = streamingMember.isRequired() ? "" : "?";
        writer.writeInline("Omit<$1T, $2S> & { $2L$3L: $1T[$2S]|string|Uint8Array|Buffer }",
                containerSymbol,
                memberName,
                optionalSuffix);
    }

    public static String getServiceName(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider
    ) {
        ServiceShape service = settings.getService(model);
        return symbolProvider.toSymbol(service).getName().replaceAll("(Client)$", "");
    }

    /**
     * The alternative should be used because the base exception may have been renamed
     * due to a collision in the model.
     *
     * @deprecated use {@link #getSyntheticBaseExceptionName}.
     */
    @Deprecated
    public static String getServiceExceptionName(String serviceName) {
        return serviceName + "ServiceException";
    }

    /**
     * If the service unfortunately defines a ServiceNameBaseException error,
     * we still generate a synthetic base error for uniformity, but it must be renamed.
     */
    public static String getSyntheticBaseExceptionName(String serviceName, Model model) {
        String serviceExceptionName = getServiceExceptionName(serviceName);
        while (true) {
            String finalServiceExceptionName = serviceExceptionName;
            boolean namingCollision = model.getStructureShapes()
                    .stream()
                    .anyMatch(structureShape -> structureShape.getId().getName().equals(finalServiceExceptionName));

            if (namingCollision) {
                serviceExceptionName = serviceExceptionName
                        .replaceAll("ServiceException$", "SyntheticServiceException");
            } else {
                break;
            }
        }
        return serviceExceptionName;
    }
}
