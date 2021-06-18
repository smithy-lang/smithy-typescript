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
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.EventStreamIndex;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.StreamingTrait;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Utility methods needed across Java packages.
 */
@SmithyUnstableApi
public final class CodegenUtils {

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
     * @param writer The code writer.
     * @param model The model for the service containing the given command.
     * @param operation The operation shape for given command.
     * @return The TypeScript type for the deserializer context
     */
    public static String getOperationDeserializerContextType(
            TypeScriptWriter writer,
            Model model,
            OperationShape operation
    ) {
        // Get default SerdeContext.
        List<String> contextInterfaceList = getDefaultOperationSerdeContextTypes(writer);
        // If event stream trait exists, add corresponding serde context type to the intersection type.
        EventStreamIndex eventStreamIndex = EventStreamIndex.of(model);
        if (eventStreamIndex.getOutputInfo(operation).isPresent()) {
            writer.addImport("EventStreamSerdeContext", "__EventStreamSerdeContext", "@aws-sdk/types");
            contextInterfaceList.add("__EventStreamSerdeContext");
        }
        return String.join(" & ", contextInterfaceList);
    }

    private static List<String> getDefaultOperationSerdeContextTypes(TypeScriptWriter writer) {
        List<String> contextInterfaceList = new ArrayList<>();
        // Get default SerdeContext.
        writer.addImport("SerdeContext", "__SerdeContext", "@aws-sdk/types");
        contextInterfaceList.add("__SerdeContext");
        return contextInterfaceList;
    }

    static List<MemberShape> getBlobStreamingMembers(Model model, StructureShape shape) {
        return shape.getAllMembers().values().stream()
                .filter(memberShape -> {
                    // Streaming blobs need to have their types modified
                    // See `writeStreamingMemberType`
                    Shape target = model.expectShape(memberShape.getTarget());
                    return target.isBlobShape() && target.hasTrait(StreamingTrait.class);
                })
                .collect(Collectors.toList());
    }

    /**
     * Ease the input streaming member restriction so that users don't need to construct a stream every time.
     * This type decoration is allowed in Smithy because it makes input type more permissive than output type
     * for the same member.
     * Refer here for more rationales: https://github.com/aws/aws-sdk-js-v3/issues/843
     */
    static void writeStreamingMemberType(
            TypeScriptWriter writer,
            Symbol containerSymbol,
            String typeName,
            MemberShape streamingMember
    ) {
        String memberName = streamingMember.getMemberName();
        String optionalSuffix = streamingMember.isRequired() ? "" : "?";
        writer.openBlock("type $LType = Omit<$T, $S> & {", "};", typeName, containerSymbol, memberName, () -> {
            writer.writeDocs(String.format("For *`%1$s[\"%2$s\"]`*, see {@link %1$s.%2$s}.",
                    containerSymbol.getName(), memberName));
            writer.write("$1L$2L: $3T[$1S]|string|Uint8Array|Buffer;", memberName, optionalSuffix, containerSymbol);
        });
        writer.writeDocs(String.format("This interface extends from `%1$s` interface. There are more parameters than"
                + " `%2$s` defined in {@link %1$s}", containerSymbol.getName(), memberName));
        writer.write("export interface $1L extends $1LType {}", typeName);
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
}
