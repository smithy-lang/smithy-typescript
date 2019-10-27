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

import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolReference;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.typescript.codegen.integration.ProtocolGenerator;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;

/**
 * Represents the resolves {@link Symbol}s and references for an
 * application protocol (e.g., "http", "mqtt", etc).
 */
public final class ApplicationProtocol {

    private static final Logger LOGGER = Logger.getLogger(ApplicationProtocol.class.getName());
    private static final String HTTP_PROTOCOL_VERSION = "^0.1.0-preview.1";

    private final SymbolReference optionsType;
    private final SymbolReference requestType;
    private final SymbolReference responseType;

    /**
     * Creates a resolved application protocol.
     *
     * @param optionsType The type used to provide options to clients and commands.
     * @param requestType The type used to represent request messages for the protocol.
     * @param responseType The type used to represent response messages for the protocol.
     */
    public ApplicationProtocol(
            SymbolReference optionsType,
            SymbolReference requestType,
            SymbolReference responseType
    ) {
        this.optionsType = optionsType;
        this.requestType = requestType;
        this.responseType = responseType;
    }

    /**
     * Creates a default HTTP application protocol.
     *
     * @return Returns the created application protocol.
     */
    public static ApplicationProtocol createDefaultHttpApplicationProtocol() {
        return new ApplicationProtocol(
                SymbolReference.builder()
                        .symbol(Symbol.builder()
                                        .namespace("@aws-sdk/types", "/")
                                        .name("HttpOptions")
                                        .build())
                        .alias("__HttpOptions")
                        .build(),
                SymbolReference.builder()
                        .symbol(Symbol.builder()
                                        .namespace("@aws-sdk/protocol-http", "/")
                                        .name("HttpRequest")
                                        .addDependency(PackageJsonGenerator.NORMAL_DEPENDENCY,
                                                       "@aws-sdk/protocol-http", HTTP_PROTOCOL_VERSION)
                                        .build())
                        .alias("__HttpRequest")
                        .build(),
                SymbolReference.builder()
                        .symbol(Symbol.builder()
                                        .namespace("@aws-sdk/protocol-http", "/")
                                        .name("HttpResponse")
                                        .addDependency(PackageJsonGenerator.NORMAL_DEPENDENCY,
                                                       "@aws-sdk/protocol-http", HTTP_PROTOCOL_VERSION)
                                        .build())
                        .alias("__HttpResponse")
                        .build()
        );
    }

    static ApplicationProtocol resolve(
            TypeScriptSettings settings,
            ServiceShape service,
            Collection<TypeScriptIntegration> integrations
    ) {
        // TODO If we're going to need to resolve this more than once, store it.
        List<String> resolvedProtocols = settings.resolveServiceProtocols(service);
        // Get the list of protocol generators that have implementations from the service.
        List<ProtocolGenerator> generators = integrations.stream()
                .flatMap(integration -> integration.getProtocolGenerators().stream())
                .filter(generator -> resolvedProtocols.contains(generator.getName()))
                .collect(Collectors.toList());

        if (generators.isEmpty()) {
            // Default to "http" if no protocols are configured.
            LOGGER.warning(String.format(
                    "No protocol generators could be found for the protocols supported by this service "
                    + "`%s`: %s. Assuming an HTTP-based protocol.", service.getId(), resolvedProtocols));
            return createDefaultHttpApplicationProtocol();
        }

        // Ensure each protocol is compatible. If not, then an explicit list must be provided.
        ApplicationProtocol applicationProtocol = generators.get(0).getApplicationProtocol();
        for (int i = 1; i < generators.size(); i++) {
            ProtocolGenerator generator = generators.get(i);
            applicationProtocol = generator.resolveApplicationProtocol(service, generators, applicationProtocol);
        }

        return applicationProtocol;
    }

    /**
     * Gets the symbol used to refer to options for this protocol.
     *
     * @return Returns the protocol options.
     */
    public SymbolReference getOptionsType() {
        return optionsType;
    }

    /**
     * Gets the symbol used to refer to the request type for this protocol.
     *
     * @return Returns the protocol request type.
     */
    public SymbolReference getRequestType() {
        return requestType;
    }

    /**
     * Gets the symbol used to refer to the response type for this protocol.
     *
     * @return Returns the protocol response type.
     */
    public SymbolReference getResponseType() {
        return responseType;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        } else if (!(o instanceof ApplicationProtocol)) {
            return false;
        }

        ApplicationProtocol that = (ApplicationProtocol) o;
        return optionsType.equals(that.optionsType)
               && requestType.equals(that.requestType)
               && responseType.equals(that.responseType);
    }

    @Override
    public int hashCode() {
        return Objects.hash(optionsType, requestType, responseType);
    }
}
