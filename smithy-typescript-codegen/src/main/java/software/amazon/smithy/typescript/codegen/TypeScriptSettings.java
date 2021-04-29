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

import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.node.BooleanNode;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.node.StringNode;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;

/**
 * Settings used by {@link TypeScriptCodegenPlugin}.
 */
public final class TypeScriptSettings {

    static final String TARGET_NAMESPACE = "targetNamespace";
    private static final Logger LOGGER = Logger.getLogger(TypeScriptSettings.class.getName());

    private static final String PACKAGE = "package";
    private static final String PACKAGE_DESCRIPTION = "packageDescription";
    private static final String PACKAGE_VERSION = "packageVersion";
    private static final String PACKAGE_JSON = "packageJson";
    private static final String SERVICE = "service";
    private static final String PROTOCOL = "protocol";
    private static final String PRIVATE = "private";
    private static final String GENERATE_CLIENT = "generateClient";
    private static final String GENERATE_SERVER_SDK = "generateServerSdk";

    private String packageName;
    private String packageDescription = "";
    private String packageVersion;
    private ObjectNode packageJson = Node.objectNode();
    private ShapeId service;
    private ObjectNode pluginSettings = Node.objectNode();
    private ShapeId protocol;
    private boolean isPrivate;
    private boolean generateClient;
    private boolean generateServerSdk;

    /**
     * Create a settings object from a configuration object node.
     *
     * @param model Model to infer the service to generate if not explicitly provided.
     * @param config Config object to load.
     * @return Returns the extracted settings.
     */
    public static TypeScriptSettings from(Model model, ObjectNode config) {
        TypeScriptSettings settings = new TypeScriptSettings();
        config.warnIfAdditionalProperties(Arrays.asList(
                PACKAGE, PACKAGE_DESCRIPTION, PACKAGE_JSON, PACKAGE_VERSION,
                SERVICE, PROTOCOL, TARGET_NAMESPACE, PRIVATE, GENERATE_CLIENT, GENERATE_SERVER_SDK));

        // Get the service from the settings or infer one from the given model.
        settings.setService(config.getStringMember(SERVICE)
                .map(StringNode::expectShapeId)
                .orElseGet(() -> inferService(model)));

        settings.setPackageName(config.expectStringMember(PACKAGE).getValue());
        settings.setPackageVersion(config.expectStringMember(PACKAGE_VERSION).getValue());
        settings.setPackageDescription(config.getStringMemberOrDefault(
                PACKAGE_DESCRIPTION, settings.getPackageName() + " client"));
        settings.packageJson = config.getObjectMember(PACKAGE_JSON).orElse(Node.objectNode());
        config.getStringMember(PROTOCOL).map(StringNode::getValue).map(ShapeId::from).ifPresent(settings::setProtocol);
        settings.setPrivate(config.getBooleanMember(PRIVATE).map(BooleanNode::getValue).orElse(false));
        settings.setGenerateClient(config.getBooleanMember(GENERATE_CLIENT).map(BooleanNode::getValue).orElse(true));
        settings.setGenerateServerSdk(
                config.getBooleanMember(GENERATE_SERVER_SDK).map(BooleanNode::getValue).orElse(false));

        settings.setPluginSettings(config);
        return settings;
    }

    // TODO: this seems reusable across generators.
    private static ShapeId inferService(Model model) {
        List<ShapeId> services = model
                .shapes(ServiceShape.class)
                .map(Shape::getId)
                .sorted()
                .collect(Collectors.toList());

        if (services.isEmpty()) {
            throw new CodegenException("Cannot infer a service to generate because the model does not "
                                       + "contain any service shapes");
        } else if (services.size() > 1) {
            throw new CodegenException("Cannot infer a service to generate because the model contains "
                                       + "multiple service shapes: " + services);
        } else {
            LOGGER.info("Inferring service to generate as " + services.get(0));
            return services.get(0);
        }
    }

    /**
     * Gets the required package name that is going to be generated.
     *
     * @return Returns the package name.
     * @throws NullPointerException if the service has not been set.
     */
    public String getPackageName() {
        return Objects.requireNonNull(packageName, PACKAGE + " not set");
    }

    public void setPackageName(String packageName) {
        this.packageName = packageName;
    }

    /**
     * Gets the description of the package that will be placed in the
     * "description" field of the generated package.json.
     *
     * @return Returns the description or an empty string if not set.
     */
    public String getPackageDescription() {
        return packageDescription;
    }

    public void setPackageDescription(String packageDescription) {
        this.packageDescription = Objects.requireNonNull(packageDescription);
    }

    /**
     * Gets the version of the generated package that will be used with the
     * generated package.json file.
     *
     * @return Returns the package version.
     */
    public String getPackageVersion() {
        return packageVersion;
    }

    public void setPackageVersion(String packageVersion) {
        this.packageVersion = packageVersion;
    }

    /**
     * Gets a chunk of custom properties to merge into the generated
     * package.json file.
     *
     * <p>This JSON is used to provide any property present in the
     * package.json file that isn't captured by any other settings.
     * This value will never be {@code null}.
     *
     * @return Returns the custom package JSON.
     */
    public ObjectNode getPackageJson() {
        return packageJson;
    }

    /**
     * Sets the custom package.json properties.
     *
     * @param packageJson package.json properties to merge in.
     */
    public void setPackageJson(ObjectNode packageJson) {
        this.packageJson = Objects.requireNonNull(packageJson);
    }

    /**
     * Gets the optional name of the service that is being generated.
     *
     * @return Returns the package name.
     * @throws NullPointerException if the service has not been set.
     */
    public ShapeId getService() {
        return Objects.requireNonNull(service, SERVICE + " not set");
    }

    public void setService(ShapeId service) {
        this.service = Objects.requireNonNull(service);
    }

    /**
     * Gets additional plugin settings.
     *
     * <p>This value will never throw or return {@code null}.
     *
     * @return Returns the entire settings object.
     */
    public ObjectNode getPluginSettings() {
        return pluginSettings;
    }

    public void setPluginSettings(ObjectNode pluginSettings) {
        this.pluginSettings = Objects.requireNonNull(pluginSettings);
    }

    /**
     * Returns if the generated package will be made private.
     *
     * @return If the package will be private.
     */
    public boolean isPrivate() {
        return isPrivate;
    }

    public void setPrivate(boolean isPrivate) {
        this.isPrivate = isPrivate;
    }

    /**
     * Returns if the generated package will include a client.
     *
     * @return If the package will include a client.
     */
    public boolean generateClient() {
        return generateClient;
    }

    public void setGenerateClient(boolean generateClient) {
        this.generateClient = generateClient;
    }

    /**
     * Returns if the generated package will include a server sdk.
     *
     * @return If the package will include a server sdk.
     */
    public boolean generateServerSdk() {
        return generateServerSdk;
    }

    public void setGenerateServerSdk(boolean generateServerSdk) {
        this.generateServerSdk = generateServerSdk;
    }

    /**
     * Gets the corresponding {@link ServiceShape} from a model.
     *
     * @param model Model to search for the service shape by ID.
     * @return Returns the found {@code Service}.
     * @throws NullPointerException if the service has not been set.
     * @throws CodegenException if the service is invalid or not found.
     */
    public ServiceShape getService(Model model) {
        return model
                .getShape(getService())
                .orElseThrow(() -> new CodegenException("Service shape not found: " + getService()))
                .asServiceShape()
                .orElseThrow(() -> new CodegenException("Shape is not a Service: " + getService()));
    }

    /**
     * Gets the configured protocol to generate.
     *
     * @return Returns the configured protocol.
     */
    public ShapeId getProtocol() {
        return protocol;
    }

    /**
     * Resolves the highest priority protocol from a service shape that is
     * supported by the generator.
     *
     * @param model Model to enable finding protocols on the service.
     * @param service Service to get the protocols from if "protocols" is not set.
     * @param supportedProtocols The set of protocol names supported by the generator.
     * @return Returns the resolved protocol name.
     * @throws UnresolvableProtocolException if no protocol could be resolved.
     */
    public ShapeId resolveServiceProtocol(Model model, ServiceShape service, Set<ShapeId> supportedProtocols) {
        if (protocol != null) {
            return protocol;
        }

        ServiceIndex serviceIndex = ServiceIndex.of(model);
        Set<ShapeId> resolvedProtocols = serviceIndex.getProtocols(service).keySet();
        if (resolvedProtocols.isEmpty()) {
            throw new UnresolvableProtocolException(
                    "Unable to derive the protocol setting of the service `" + service.getId() + "` because no "
                    + "protocol definition traits were present. You need to set an explicit `protocol` to "
                    + "generate in smithy-build.json to generate this service.");
        }

        return resolvedProtocols.stream()
                .filter(supportedProtocols::contains)
                .findFirst()
                .orElseThrow(() -> new UnresolvableProtocolException(String.format(
                        "The %s service supports the following unsupported protocols %s. The following protocol "
                        + "generators were found on the class path: %s",
                        service.getId(), resolvedProtocols, supportedProtocols)));
    }

    /**
     * Sets the protocol to generate.
     *
     * @param protocol Protocols to generate.
     */
    public void setProtocol(ShapeId protocol) {
        this.protocol = Objects.requireNonNull(protocol);
    }
}
