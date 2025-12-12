/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.integration;

import java.util.Collections;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.protocol.traits.Rpcv2CborTrait;
import software.amazon.smithy.typescript.codegen.LanguageTarget;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.typescript.codegen.schema.SchemaGenerationAllowlist;
import software.amazon.smithy.utils.MapUtils;
import software.amazon.smithy.utils.SmithyInternalApi;


/**
 * Adds a protocol implementation to the runtime config.
 */
@SmithyInternalApi
public final class AddProtocolConfig implements TypeScriptIntegration {

  @Override
    public Map<String, Consumer<TypeScriptWriter>> getRuntimeConfigWriters(
        TypeScriptSettings settings,
        Model model,
        SymbolProvider symbolProvider,
        LanguageTarget target
    ) {
        if (!SchemaGenerationAllowlist.allows(settings.getService(), settings)) {
            return Collections.emptyMap();
        }

        String namespace = settings.getService().getNamespace();

        switch (target) {
            case SHARED:
                if (Objects.equals(settings.getProtocol(), Rpcv2CborTrait.ID)) {
                    return MapUtils.of(
                        "protocol", writer -> {
                            writer.addImportSubmodule(
                                "SmithyRpcV2CborProtocol", null,
                                TypeScriptDependency.SMITHY_CORE, "/cbor");
                            writer.write("SmithyRpcV2CborProtocol");
                        },
                       "protocolSettings", writer -> {
                             writer.write("""
                                 {
                                   defaultNamespace: $S,
                                 }""",
                                 namespace
                            );
                        }
                    );
                }
            case BROWSER:
            case NODE:
            default:
                return Collections.emptyMap();
        }
    }
}
