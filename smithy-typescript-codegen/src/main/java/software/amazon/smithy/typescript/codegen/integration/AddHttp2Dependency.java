/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
package software.amazon.smithy.typescript.codegen.integration;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.node.ArrayNode;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.traits.Trait;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.MapUtils;
import software.amazon.smithy.utils.SmithyInternalApi;

/**
 * Configures the generated client to use NodeHttp2Handler when the service's
 * protocol trait specifies eventStreamHttp containing "h2".
 *
 * <p>This mirrors the behavior of AddHttp2Dependency in smithy-aws-typescript-codegen
 * but operates on any protocol trait that has an eventStreamHttp property,
 * not just AWS protocol traits.
 */
@SmithyInternalApi
public final class AddHttp2Dependency implements TypeScriptIntegration {

    @Override
    public List<String> runAfter() {
        return List.of(new AddEventStreamDependency().name());
    }

    @Override
    public Map<String, Consumer<TypeScriptWriter>> getRuntimeConfigWriters(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        LanguageTarget target
    ) {
        ServiceShape service = settings.getService(model);
        if (!requiresHttp2ForEventStreams(model, service)) {
            return Collections.emptyMap();
        }
        switch (target) {
            case NODE:
                return MapUtils.of("requestHandler", writer -> {
                    writer.addImport(
                        "NodeHttp2Handler",
                        "RequestHandler",
                        TypeScriptDependency.AWS_SDK_NODE_HTTP_HANDLER
                    );
                    writer.openBlock(
                        "RequestHandler.create(config?.requestHandler ?? (async () => ({",
                        "})))",
                        () -> {
                            writer.write("...await defaultConfigProvider(),");
                            writer.write("disableConcurrentStreams: true");
                        }
                    );
                });
            default:
                return Collections.emptyMap();
        }
    }

    /**
     * Checks whether the service's protocol trait has eventStreamHttp containing "h2".
     */
    private static boolean requiresHttp2ForEventStreams(Model model, ServiceShape service) {
        ServiceIndex serviceIndex = ServiceIndex.of(model);
        for (ShapeId protocolId : serviceIndex.getProtocols(service).keySet()) {
            Trait protocolTrait = service.findTrait(protocolId).orElse(null);
            if (protocolTrait == null) {
                continue;
            }
            Node traitNode = protocolTrait.toNode();
            if (!traitNode.isObjectNode()) {
                continue;
            }
            ArrayNode eventStreamHttp = traitNode.expectObjectNode()
                .getArrayMember("eventStreamHttp")
                .orElse(null);
            if (eventStreamHttp == null) {
                continue;
            }
            for (Node entry : eventStreamHttp) {
                if (entry.isStringNode() && entry.expectStringNode().getValue().equals("h2")) {
                    return true;
                }
            }
        }
        return false;
    }
}
