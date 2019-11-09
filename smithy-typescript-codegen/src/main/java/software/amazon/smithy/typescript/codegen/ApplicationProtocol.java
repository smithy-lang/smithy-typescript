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

    private final String name;
    private final SymbolReference optionsType;
    private final SymbolReference requestType;
    private final SymbolReference responseType;

    /**
     * Creates a resolved application protocol.
     *
     * @param name The protocol name (e.g., http, mqtt, etc).
     * @param optionsType The type used to provide options to clients and commands.
     * @param requestType The type used to represent request messages for the protocol.
     * @param responseType The type used to represent response messages for the protocol.
     */
    public ApplicationProtocol(
            String name,
            SymbolReference optionsType,
            SymbolReference requestType,
            SymbolReference responseType
    ) {
        this.name = name;
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
                "http",
                SymbolReference.builder()
                        .symbol(createHttpSymbol(TypeScriptDependency.AWS_SDK_TYPES, "HttpOptions"))
                        .alias("__HttpOptions")
                        .build(),
                SymbolReference.builder()
                        .symbol(createHttpSymbol(TypeScriptDependency.AWS_SDK_PROTOCOL_HTTP, "HttpRequest"))
                        .alias("__HttpRequest")
                        .build(),
                SymbolReference.builder()
                        .symbol(createHttpSymbol(TypeScriptDependency.AWS_SDK_PROTOCOL_HTTP, "HttpResponse"))
                        .alias("__HttpResponse")
                        .build()
        );
    }

    private static Symbol createHttpSymbol(TypeScriptDependency dependency, String symbolName) {
        return Symbol.builder()
                .namespace(dependency.packageName, "/")
                .name(symbolName)
                .addDependency(dependency)
                .addDependency(TypeScriptDependency.AWS_SDK_FETCH_HTTP_HANDLER)
                .addDependency(TypeScriptDependency.AWS_SDK_NODE_HTTP_HANDLER)
                .build();
    }

    static ApplicationProtocol resolve(
            TypeScriptSettings settings,
            ServiceShape service,
            Collection<TypeScriptIntegration> integrations
    ) {
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
     * Gets the protocol name.
     *
     * <p>All HTTP protocols should start with "http".
     * All MQTT protocols should start with "mqtt".
     *
     * @return Returns the protocol name.
     */
    public String getName() {
        return name;
    }

    /**
     * Checks if the protocol is an HTTP based protocol.
     *
     * @return Returns true if it is HTTP based.
     */
    public boolean isHttpProtocol() {
        return getName().startsWith("http");
    }

    /**
     * Checks if the protocol is an MQTT based protocol.
     *
     * @return Returns true if it is MQTT based.
     */
    public boolean isMqttProtocol() {
        return getName().startsWith("mqtt");
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
