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

import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.typescript.codegen.integration.EventStreamGenerator;

/**
 * Utility methods needed across Java packages.
 */
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


    public static String getOperationSerializerContextType(
            TypeScriptWriter writer, Model model, OperationShape operation) {
        // add default SerdeContext
        List<String> contextInterfaceList = getDefaultOperationSerdeContextTypes(writer);
        //check if event stream trait exists
        if (EventStreamGenerator.operationHasEventStreamInput(model, operation)
        ) {
            writer.addImport("EventStreamSerdeContext", "__EventStreamSerdeContext", "@aws-sdk/types");
            contextInterfaceList.add("__EventStreamSerdeContext");
        }
        return String.join(" & ", contextInterfaceList);
    }

    public static String getOperationDeserializerContextType(
            TypeScriptWriter writer, Model model, OperationShape operation) {
        // add default SerdeContext
        List<String> contextInterfaceList = getDefaultOperationSerdeContextTypes(writer);
        //check if event stream trait exists
        if (EventStreamGenerator.operationHasEventStreamOutput(model, operation)
        ) {
            writer.addImport("EventStreamSerdeContext", "__EventStreamSerdeContext", "@aws-sdk/types");
            contextInterfaceList.add("__EventStreamSerdeContext");
        }
        return String.join(" & ", contextInterfaceList);
    }

    private static List<String> getDefaultOperationSerdeContextTypes(TypeScriptWriter writer) {
        List<String> contextInterfaceList = new ArrayList<>();
        // add default SerdeContext
        writer.addImport("SerdeContext", "__SerdeContext", "@aws-sdk/types");
        contextInterfaceList.add("__SerdeContext");
        return contextInterfaceList;
    }
}
