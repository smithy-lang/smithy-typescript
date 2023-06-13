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
            writer.addImport("EventStreamSerdeContext", "__EventStreamSerdeContext", "@aws-sdk/types");
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
            writer.addImport("EventStreamSerdeContext", "__EventStreamSerdeContext",
                    TypeScriptDependency.AWS_SDK_TYPES.packageName);
            contextInterfaceList.add("__EventStreamSerdeContext");
        }
        if (AddSdkStreamMixinDependency.hasStreamingBlobDeser(settings, model, operation)) {
            writer.addImport("SdkStreamSerdeContext", "__SdkStreamSerdeContext",
                    TypeScriptDependency.AWS_SDK_TYPES.packageName);
            contextInterfaceList.add("__SdkStreamSerdeContext");
        }
        return String.join(" & ", contextInterfaceList);
    }

    private static List<String> getDefaultOperationSerdeContextTypes(TypeScriptWriter writer) {
        List<String> contextInterfaceList = new ArrayList<>();
        // Get default SerdeContext.
        writer.addImport("SerdeContext", "__SerdeContext", TypeScriptDependency.SMITHY_TYPES);
        contextInterfaceList.add("__SerdeContext");
        return contextInterfaceList;
    }

    static List<MemberShape> getBlobStreamingMembers(Model model, StructureShape shape) {
        return shape.getAllMembers().values().stream()
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
        String memberName = streamingMember.getMemberName();
        String optionalSuffix = streamingMember.isRequired() ? "" : "?";
        writer.openBlock("export type $LType = Omit<$T, $S> & {", "};", typeName,
                containerSymbol, memberName, () -> {
                        writer.writeDocs(String.format("For *`%1$s[\"%2$s\"]`*, see {@link %1$s.%2$s}.",
                                containerSymbol.getName(), memberName));
                        writer.write("$1L$2L: $3T[$1S]|string|Uint8Array|Buffer;", memberName, optionalSuffix,
                                containerSymbol);
        });

        writer.writeDocs("@public\n\nThe input for {@link " + commandName + "}.");
        writer.write("export interface $1L extends $1LType {}", typeName);
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
        writer.addImport("MetadataBearer", "__MetadataBearer", TypeScriptDependency.AWS_SDK_TYPES.packageName);
        writer.addImport("SdkStream", "__SdkStream", TypeScriptDependency.AWS_SDK_TYPES.packageName);
        writer.addImport("WithSdkStreamMixin", "__WithSdkStreamMixin", TypeScriptDependency.AWS_SDK_TYPES.packageName);

        writer.writeDocs("@public\n\nThe output of {@link " + commandName + "}.");
        writer.write(
            "export interface $L extends __WithSdkStreamMixin<$T, $S>, __MetadataBearer {}",
            typeName,
            containerSymbol,
            memberName
        );
    }

    static List<MemberShape> getBlobPayloadMembers(Model model, StructureShape shape) {
        return shape.getAllMembers().values().stream()
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

        writer.addImport("BlobTypes", null, TypeScriptDependency.AWS_SDK_TYPES);

        writer.writeDocs("@public");
        writer.openBlock("export type $LType = Omit<$T, $S> & {", "};",
            typeName,
            containerSymbol,
            memberName,
            () -> {
                writer.write("$1L$2L: BlobTypes;", memberName, optionalSuffix);
            }
        );

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
        writer.openBlock("export type $LType = Omit<$T, $S> & {", "};",
            typeName,
            containerSymbol,
            memberName,
            () -> {
                writer.write("$1L$2L: Uint8ArrayBlobAdapter;", memberName, optionalSuffix);
            }
        );

        writer.writeDocs("@public\n\nThe output of {@link " + commandName + "}.");
        writer.write(
            "export interface $1L extends $1LType, __MetadataBearer {}",
            typeName
        );
    }

    /**
     * Returns the list of function parameter key-value pairs to be written for
     * provided parameters map.
     *
     * @param paramsMap Map of paramters to generate a parameters string for.
     * @return The list of parameters to be written.
     */
    static List<String> getFunctionParametersList(Map<String, Object> paramsMap) {
        List<String> functionParametersList = new ArrayList<String>();

        if (!paramsMap.isEmpty()) {
            for (Map.Entry<String, Object> param : paramsMap.entrySet()) {
                String key = param.getKey();
                Object value = param.getValue();
                if (value instanceof Symbol) {
                    String symbolName = ((Symbol) value).getName();
                    if (key.equals(symbolName)) {
                        functionParametersList.add(key);
                    } else {
                        functionParametersList.add(String.format("%s: %s", key, symbolName));
                    }
                } else if (value instanceof String) {
                    functionParametersList.add(String.format("%s: '%s'", key, value));
                } else if (value instanceof Boolean) {
                    functionParametersList.add(String.format("%s: %s", key, value));
                } else if (value instanceof List) {
                    if (!((List) value).isEmpty() && !(((List) value).get(0) instanceof String)) {
                        throw new CodegenException("Plugin function parameters not supported for type List<"
                            + ((List) value).get(0).getClass() + ">");
                    }
                    functionParametersList.add(String.format("%s: [%s]",
                        key, ((List<String>) value).stream()
                            .collect(Collectors.joining("\", \"", "\"", "\""))));
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
                containerSymbol, memberName, optionalSuffix);
    }

    public static String getServiceName(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider
    ) {
        ServiceShape service = settings.getService(model);
        return symbolProvider.toSymbol(service).getName().replaceAll("(Client)$", "");
    }

    public static String getServiceExceptionName(String serviceName) {
        return serviceName + "ServiceException";
    }
}
