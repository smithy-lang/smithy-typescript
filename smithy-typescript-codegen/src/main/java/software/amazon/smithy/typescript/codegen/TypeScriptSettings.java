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
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.node.StringNode;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.traits.ProtocolsTrait;

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
    private static final String PROTOCOLS = "protocols";

    private String packageName;
    private String packageDescription = "";
    private String packageVersion;
    private ObjectNode packageJson = Node.objectNode();
    private ShapeId service;
    private ObjectNode pluginSettings = Node.objectNode();
    private List<String> protocols = new ArrayList<>();

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
                PACKAGE, PACKAGE_DESCRIPTION, PACKAGE_JSON, PACKAGE_VERSION, SERVICE, TARGET_NAMESPACE));

        // Get the service from the settings or infer one from the given model.
        settings.setService(config.getStringMember(SERVICE)
                .map(StringNode::expectShapeId)
                .orElseGet(() -> inferService(model)));

        settings.setPackageName(config.expectStringMember(PACKAGE).getValue());
        settings.setPackageVersion(config.expectStringMember(PACKAGE_VERSION).getValue());
        settings.setPackageDescription(config.getStringMemberOrDefault(
                PACKAGE_DESCRIPTION, settings.getPackageName() + " client"));
        settings.packageJson = config.getObjectMember(PACKAGE_JSON).orElse(Node.objectNode());

        config.getArrayMember(PROTOCOLS)
                .ifPresent(value -> settings.setProtocols(value.getElementsAs(StringNode::getValue)));

        settings.setPluginSettings(config);
        return settings;
    }

    // TODO: this seems reusable across generators.
    private static ShapeId inferService(Model model) {
        List<ShapeId> services = model.getShapeIndex()
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
     * Gets the corresponding {@link ServiceShape} from a model.
     *
     * @param model Model to search for the service shape by ID.
     * @return Returns the found {@code Service}.
     * @throws NullPointerException if the service has not been set.
     * @throws CodegenException if the service is invalid or not found.
     */
    public ServiceShape getService(Model model) {
        return model.getShapeIndex()
                .getShape(getService())
                .orElseThrow(() -> new CodegenException("Service shape not found: " + getService()))
                .asServiceShape()
                .orElseThrow(() -> new CodegenException("Shape is not a Service: " + getService()));
    }

    /**
     * Gets the explicitly configured list of protocols to generate.
     *
     * <p>Every returned protocol must utilize compatible application protocols.
     *
     * @return Returns the configured list of protocols or an empty list.
     */
    public List<String> getProtocols() {
        return protocols;
    }

    /**
     * Gets the list of protocols from the "protocols" setting or from the
     * service object.
     *
     * <p>Every returned protocol must utilize compatibke application
     * protocols. You will need to explicitly set the "protocols" setting
     * to a coherent list of protocols if one or more protocols are
     * incompatible on the service.
     *
     * @param service Service to get the protocols from if "protocols" is not set.
     * @return Returns the possibly empty list of protocols.
     * TODO: This could be moved into a shared codegen feature.
     */
    public List<String> resolveServiceProtocols(ServiceShape service) {
        if (!protocols.isEmpty()) {
            return protocols;
        }

        List<String> resolvedProtocols = service.getTrait(ProtocolsTrait.class)
                .orElseThrow(() -> new CodegenException(
                        "Unable to derive the protocols setting of the service `" + service.getId() + "` because no "
                        + "`@protocols` trait was set. You need to set an explicit list of `protocols` to generate "
                        + "in smithy-build.json to generate this service."))
                .getProtocolNames();

        if (resolvedProtocols.isEmpty()) {
            LOGGER.warning("Service `protocols` trait defines no protocols: " + service.getId());
        }

        return resolvedProtocols;
    }

    /**
     * Sets the list of supported protocols.
     *
     * @param protocols Protocols to support.
     */
    public void setProtocols(List<String> protocols) {
        this.protocols = protocols;
    }
}
