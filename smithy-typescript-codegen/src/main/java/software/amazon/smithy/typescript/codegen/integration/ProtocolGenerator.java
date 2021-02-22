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

import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.typescript.codegen.ApplicationProtocol;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.CaseUtils;

/**
 * Smithy protocol code generators.
 */
public interface ProtocolGenerator {
    /**
     * Sanitizes the name of the protocol so it can be used as a symbol
     * in TypeScript.
     *
     * <p>For example, the default implementation converts "." to "_",
     * and converts "-" to become camelCase separated words. This means
     * that "aws.rest-json-1.1" becomes "Aws_RestJson1_1".
     *
     * @param name Name of the protocol to sanitize.
     * @return Returns the sanitized name.
     */
    static String getSanitizedName(String name) {
        String result = name.replace(".", "_");
        return CaseUtils.toCamelCase(result, true, '-');
    }

    /**
     * Gets the supported protocol {@link ShapeId}.
     *
     * @return Returns the protocol supported
     */
    ShapeId getProtocol();

    /**
     * Gets the name of the protocol.
     *
     * <p>The default implementation is the ShapeId name of the protocol trait in
     * Smithy models (e.g., "aws.protocols#restJson1" would return "restJson1").
     *
     * @return Returns the protocol name.
     */
    default String getName() {
        return getProtocol().getName();
    }

    /**
     * Creates an application protocol for the generator.
     *
     * @return Returns the created application protocol.
     */
    ApplicationProtocol getApplicationProtocol();

    /**
     * Determines if two protocol generators are compatible at the
     * application protocol level, meaning they both use HTTP, or MQTT
     * for example.
     *
     * <p>Two protocol implementations are considered compatible if the
     * {@link ApplicationProtocol#equals} method of {@link #getApplicationProtocol}
     * returns true when called with {@code other}. The default implementation
     * should work for most interfaces, but may be overridden for more in-depth
     * handling of things like minor version incompatibilities.
     *
     * <p>By default, if the application protocols are considered equal, then
     * {@code other} is returned.
     *
     * @param service Service being generated.
     * @param protocolGenerators Other protocol generators that are being generated.
     * @param other Protocol generator to resolve against.
     * @return Returns the resolved application protocol object.
     */
    default ApplicationProtocol resolveApplicationProtocol(
            ServiceShape service,
            Collection<ProtocolGenerator> protocolGenerators,
            ApplicationProtocol other
    ) {
        if (!getApplicationProtocol().equals(other)) {
            String protocolNames = protocolGenerators.stream()
                    .map(ProtocolGenerator::getProtocol)
                    .map(ShapeId::getName)
                    .sorted()
                    .collect(Collectors.joining(", "));
            throw new CodegenException(String.format(
                    "All of the protocols generated for a service must be runtime compatible, but "
                    + "protocol `%s` is incompatible with other application protocols: [%s]. Please pick a "
                    + "set of compatible protocols using the `protocols` option when generating %s.",
                    getProtocol().getName(), protocolNames, service.getId()));
        }

        return other;
    }

    /**
     * Generates any standard code for service request/response serde.
     *
     * @param context Serde context.
     */
    default void generateSharedComponents(GenerationContext context) {
    }

    /**
     * Generates the code used to serialize the shapes of a service
     * for requests.
     *
     * @param context Serialization context.
     */
    void generateRequestSerializers(GenerationContext context);

    /**
     * Generates the code used to deserialize the shapes of a service
     * for responses.
     *
     * @param context Deserialization context.
     */
    void generateResponseDeserializers(GenerationContext context);

    /**
     * Generates the name of a serializer function for shapes of a service.
     *
     * @param symbol The symbol the serializer function is being generated for.
     * @param protocol Name of the protocol being generated.
     * @return Returns the generated function name.
     */
    static String getSerFunctionName(Symbol symbol, String protocol) {
        // e.g., serializeAws_restJson1_1ExecuteStatement
        String functionName = "serialize" + ProtocolGenerator.getSanitizedName(protocol);

        // Update the function to have a component based on the symbol.
        functionName += getSerdeFunctionSymbolComponent(symbol, symbol.expectProperty("shape", Shape.class));

        return functionName;
    }

    /**
     * Generates the name of a deserializer function for shapes of a service.
     *
     * @param symbol The symbol the deserializer function is being generated for.
     * @param protocol Name of the protocol being generated.
     * @return Returns the generated function name.
     */
    static String getDeserFunctionName(Symbol symbol, String protocol) {
        // e.g., deserializeAws_restJson1_1ExecuteStatement
        String functionName = "deserialize" + ProtocolGenerator.getSanitizedName(protocol);

        // Update the function to have a component based on the symbol.
        functionName += getSerdeFunctionSymbolComponent(symbol, symbol.expectProperty("shape", Shape.class));

        return functionName;
    }

    static String getSerdeFunctionSymbolComponent(Symbol symbol, Shape shape) {
        switch (shape.getType()) {
            case LIST:
            case SET:
            case MAP:
            case DOCUMENT:
                // These need specialized serializers because they use complex but
                // non-generated types, so generate a separate name.
                return shape.getId().getName();
            default:
                return symbol.getName();
        }
    }

    /**
     * Context object used for service serialization and deserialization.
     */
    class GenerationContext {
        private TypeScriptSettings settings;
        private Model model;
        private ServiceShape service;
        private SymbolProvider symbolProvider;
        private TypeScriptWriter writer;
        private List<TypeScriptIntegration> integrations;
        private String protocolName;

        public TypeScriptSettings getSettings() {
            return settings;
        }

        public void setSettings(TypeScriptSettings settings) {
            this.settings = settings;
        }

        public Model getModel() {
            return model;
        }

        public void setModel(Model model) {
            this.model = model;
        }

        public ServiceShape getService() {
            return service;
        }

        public void setService(ServiceShape service) {
            this.service = service;
        }

        public SymbolProvider getSymbolProvider() {
            return symbolProvider;
        }

        public void setSymbolProvider(SymbolProvider symbolProvider) {
            this.symbolProvider = symbolProvider;
        }

        public TypeScriptWriter getWriter() {
            return writer;
        }

        public void setWriter(TypeScriptWriter writer) {
            this.writer = writer;
        }

        public List<TypeScriptIntegration> getIntegrations() {
            return integrations;
        }

        public void setIntegrations(List<TypeScriptIntegration> integrations) {
            this.integrations = integrations;
        }

        public String getProtocolName() {
            return protocolName;
        }

        public void setProtocolName(String protocolName) {
            this.protocolName = protocolName;
        }
    }
}
