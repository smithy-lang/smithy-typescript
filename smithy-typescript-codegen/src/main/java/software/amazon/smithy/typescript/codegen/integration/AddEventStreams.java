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

import static software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin.Convention.HAS_CONFIG;

import java.util.List;
import java.util.Set;
import java.util.function.BiFunction;

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
public class AddEventStreams implements TypeScriptIntegration {

    private BiFunction<EventStreamIndex, OperationShape, Boolean> operationHasEventStreamInput =
            (eventStreamIndex, operationShape) ->
                    eventStreamIndex.getInputInfo(operationShape).isPresent();

    private BiFunction<EventStreamIndex, OperationShape, Boolean> operationHasEventStream =
            (eventStreamIndex, operationShape) ->
                    eventStreamIndex.getOutputInfo(operationShape).isPresent()
                            || eventStreamIndex.getInputInfo(operationShape).isPresent();

    @Override
    public List<RuntimeClientPlugin> getClientPlugins() {
        return ListUtils.of(
                RuntimeClientPlugin.builder()
                        .withConventions(TypeScriptDependency.MIDDLEWARE_EVENT_STREAM.dependency, "EventStream")
                        .operationPredicate((m, s, o) -> hasEventStream(m, s, operationHasEventStreamInput))
                        .build(),
                RuntimeClientPlugin.builder()
                        .withConventions(
                                TypeScriptDependency.MIDDLEWARE_EVENT_STREAM.dependency,
                                "EventStream",
                                HAS_CONFIG
                        )
                        .servicePredicate((m, s) -> hasEventStream(m, s, operationHasEventStream))
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
        if (!hasEventStream(model, settings.getService(model), operationHasEventStream)) {
            return;
        }
        writer.addImport(
                "EventStreamSerdeProvider",
                "EventStreamSerdeProvider",
                TypeScriptDependency.AWS_SDK_TYPES.packageName
        );
        writer.writeDocs("The function that provides necessary utilities for generating and signing event stream");
        writer.write("eventStreamSerdeProvider?: EventStreamSerdeProvider;");
    }

    @Override
    public void addRuntimeConfigValues(
            TypeScriptSettings settings,
            Model model,
            SymbolProvider symbolProvider,
            TypeScriptWriter writer,
            LanguageTarget target
    ) {
        if (!hasEventStream(model, settings.getService(model), operationHasEventStream)) {
            return;
        }

        switch (target) {
            case NODE:
                writer.addDependency(TypeScriptDependency.AWS_SDK_UTIL_EVENT_STREAM_NODE);
                writer.addImport(
                        "eventStreamSerdeProvider",
                        "eventStreamSerdeProvider",
                        TypeScriptDependency.AWS_SDK_UTIL_EVENT_STREAM_NODE.packageName
                );
                writer.write("eventStreamSerdeProvider");
                break;
            case BROWSER:
                writer.addImport(
                        "invalidFunction",
                        "invalidFunction",
                        TypeScriptDependency.INVALID_DEPENDENCY.packageName
                );
                writer.openBlock("eventStreamSerdeProvider: invalidFunction(", ")", () -> {
                    writer.write("\"event stream serde for browser is not available\"");
                });
                break;
            default:
                // do nothing
        }
    }

    private static boolean hasEventStream(
            Model model,
            ServiceShape service,
            BiFunction<EventStreamIndex, OperationShape, Boolean> predicate
    ) {
        TopDownIndex topDownIndex = model.getKnowledge(TopDownIndex.class);
        Set<OperationShape> operations = topDownIndex.getContainedOperations(service);
        EventStreamIndex eventStreamIndex = model.getKnowledge(EventStreamIndex.class);
        for (OperationShape operation : operations) {
            if (predicate.apply(eventStreamIndex, operation)) {
                return true;
            }
        }
        return false;
    }
}
