/*
 * Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
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

import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.TopDownIndex;
import software.amazon.smithy.model.shapes.BlobShape;
import software.amazon.smithy.model.shapes.MemberShape;
import software.amazon.smithy.model.shapes.OperationShape;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.StructureShape;
import software.amazon.smithy.model.traits.StreamingTrait;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.MapUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Add runtime config for injecting utility functions to consume the JavaScript
 * runtime-specific stream implementations.
 */
@SmithyInternalApi
public final class AddSdkStreamMixinDependency implements TypeScriptIntegration {

    @Override
    public void addConfigInterfaceFields(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        TypeScriptWriter writer
    ) {
        if (!hasStreamingBlobDeser(settings, model)) {
            return;
        }

        writer.addImport("SdkStreamMixinInjector", "__SdkStreamMixinInjector",
                TypeScriptDependency.SMITHY_TYPES);
        writer.writeDocs("The internal function that inject utilities to runtime-specific stream to help users"
                + " consume the data\n@internal");
        writer.write("sdkStreamMixin?: __SdkStreamMixinInjector;\n");
    }

    @Override
    public Map<String, Consumer<TypeScriptWriter>> getRuntimeConfigWriters(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        LanguageTarget target
    ) {
        if (!hasStreamingBlobDeser(settings, model)) {
            return Collections.emptyMap();
        }

        if (target == LanguageTarget.SHARED) {
           return MapUtils.of("sdkStreamMixin", writer -> {
               writer.addDependency(TypeScriptDependency.UTIL_STREAM);
               writer.addImport("sdkStreamMixin", "sdkStreamMixin", TypeScriptDependency.UTIL_STREAM);
               writer.write("sdkStreamMixin");
           });
        } else {
            return Collections.emptyMap();
        }
    }

    private static boolean hasStreamingBlobDeser(TypeScriptSettings settings, Model model) {
        ServiceShape serviceShape = settings.getService(model);
        TopDownIndex topDownIndex = TopDownIndex.of(model);
        Set<OperationShape> operations = topDownIndex.getContainedOperations(serviceShape);
        for (OperationShape operation : operations) {
            if (hasStreamingBlobDeser(settings, model, operation)) {
                return true;
            }
        }
        return false;
    }

    public static boolean hasStreamingBlobDeser(TypeScriptSettings settings, Model model, OperationShape operation) {
        StructureShape ioShapeToDeser = (settings.generateServerSdk())
          ? model.expectShape(operation.getInputShape()).asStructureShape().get()
          : model.expectShape(operation.getOutputShape()).asStructureShape().get();
        for (MemberShape member : ioShapeToDeser.members()) {
            Shape shape = model.expectShape(member.getTarget());
            if (shape instanceof BlobShape && shape.hasTrait(StreamingTrait.class)) {
                return true;
            }
        }
        return false;
    }
}
