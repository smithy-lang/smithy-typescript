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

import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.EventStreamIndex;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.ListUtils;

/**
 * Adds event streams if needed.
 */
public final class AddEventStreamDependency implements TypeScriptIntegration {

    @Override
    public List<RuntimeClientPlugin> getClientPlugins() {
        return ListUtils.of(
                RuntimeClientPlugin.builder()
                        .withConventions(TypeScriptDependency.AWS_SDK_EVENTSTREAM_SERDE_CONFIG_RESOLVER.dependency,
                                "EventStreamSerde", RuntimeClientPlugin.Convention.HAS_CONFIG)
                        .servicePredicate(AddEventStreamDependency::hasEventStream)
                        .build()
        );
    }

    @Override
    public void addConfigInterfaceFields(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            TypeScriptWriter writer
    ) {
        if (!hasEventStream(model, settings.getService(model))) {
            return;
        }

        writer.addDependency(TypeScriptDependency.AWS_SDK_EVENTSTREAM_SERDE_CONFIG_RESOLVER);
        writer.addImport("EventStreamSerdeProvider", "__EventStreamSerdeProvider",
                TypeScriptDependency.AWS_SDK_TYPES.packageName);
        writer.writeDocs("The function that provides necessary utilities for generating and signing event stream");
        writer.write("eventStreamSerdeProvider?: __EventStreamSerdeProvider;\n");
    }

    @Override
    public void addRuntimeConfigValues(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            TypeScriptWriter writer,
            LanguageTarget target
    ) {
        if (!hasEventStream(model, settings.getService(model))) {
            return;
        }

        switch (target) {
            case NODE:
                writer.addDependency(TypeScriptDependency.AWS_SDK_EVENTSTREAM_SERDE_NODE);
                writer.addImport("eventStreamSerdeProvider", "eventStreamSerdeProvider",
                        TypeScriptDependency.AWS_SDK_EVENTSTREAM_SERDE_NODE.packageName);
                writer.write("eventStreamSerdeProvider");
                break;
            case BROWSER:
                writer.addDependency(TypeScriptDependency.AWS_SDK_EVENTSTREAM_SERDE_BROWSER);
                writer.addImport("eventStreamSerdeProvider", "eventStreamSerdeProvider",
                        TypeScriptDependency.AWS_SDK_EVENTSTREAM_SERDE_BROWSER.packageName);
                writer.write("eventStreamSerdeProvider");
                break;
            case REACT_NATIVE:
                // TODO: add ReactNative eventstream support
                writer.addDependency(TypeScriptDependency.INVALID_DEPENDENCY);
                writer.addImport("invalidFunction", "invalidFunction",
                        TypeScriptDependency.INVALID_DEPENDENCY.packageName);
                writer.write("eventStreamSerdeProvider: invalidFunction(\"event stream is not supported in "
                                + "ReactNative\") as any,");
                break;
            default:
                // do nothing
        }
    }

    private static boolean hasEventStream(
            Model model,
            ServiceShape service
    ) {
        TopDownIndex topDownIndex = model.getKnowledge(TopDownIndex.class);
        Set<OperationShape> operations = topDownIndex.getContainedOperations(service);
        EventStreamIndex eventStreamIndex = model.getKnowledge(EventStreamIndex.class);
        for (OperationShape operation : operations) {
            if (eventStreamIndex.getInputInfo(operation).isPresent()
                    || eventStreamIndex.getOutputInfo(operation).isPresent()
            ) {
                return true;
            }
        }
        return false;
    }
}
