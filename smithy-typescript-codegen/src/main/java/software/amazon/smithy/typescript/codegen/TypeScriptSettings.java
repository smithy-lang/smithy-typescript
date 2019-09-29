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
import java.util.Objects;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.ShapeId;

/**
 * Settings used by {@link TypeScriptCodegenPlugin}.
 */
public final class TypeScriptSettings {

    static final String TARGET_NAMESPACE = "targetNamespace";
    private static final String PACKAGE = "package";
    private static final String PACKAGE_DESCRIPTION = "packageDescription";
    private static final String PACKAGE_VERSION = "packageVersion";
    private static final String PACKAGE_JSON = "packageJson";
    private static final String SERVICE = "service";

    private String packageName;
    private String packageDescription;
    private String packageVersion;
    private ObjectNode packageJson;
    private ShapeId service;
    private ObjectNode pluginSettings = Node.objectNode();

    /**
     * Create a settings object from a configuration object node.
     *
     * @param config Config object to load.
     * @return Returns the extracted settings.
     */
    public static TypeScriptSettings from(ObjectNode config) {
        TypeScriptSettings settings = new TypeScriptSettings();
        config.warnIfAdditionalProperties(Arrays.asList(
                PACKAGE, PACKAGE_DESCRIPTION, PACKAGE_JSON, PACKAGE_VERSION, SERVICE, TARGET_NAMESPACE));
        settings.setService(config.expectStringMember(SERVICE).expectShapeId());
        settings.setPackageName(config.expectStringMember(PACKAGE).getValue());
        settings.setPackageVersion(config.expectStringMember(PACKAGE_VERSION).getValue());
        settings.setPackageDescription(config.getStringMemberOrDefault(
                PACKAGE_DESCRIPTION, settings.getPackageName() + " client"));
        settings.packageJson = config.getObjectMember(PACKAGE_JSON).orElse(Node.objectNode());
        settings.setPluginSettings(config);
        return settings;
    }

    /**
     * Gets the required package name that is going to be generated.
     *
     * @return Returns the package name.
     */
    public String getPackageName() {
        return Objects.requireNonNull(packageName, PACKAGE + " not set");
    }

    public void setPackageName(String packageName) {
        this.packageName = packageName;
    }

    /**
     * Gets the optional name of the service that is being generated.
     *
     * @return Returns the package name.
     */
    public ShapeId getService() {
        return Objects.requireNonNull(service, SERVICE + " not set");
    }

    public void setService(ShapeId service) {
        this.service = service;
    }

    /**
     * Gets additional plugin settings.
     *
     * @return Returns the entire settings object.
     */
    public ObjectNode getPluginSettings() {
        return pluginSettings;
    }

    public void setPluginSettings(ObjectNode pluginSettings) {
        this.pluginSettings = pluginSettings;
    }

    /**
     * Gets the corresponding {@link ServiceShape} from a model.
     *
     * @param model Model to search for the service shape by ID.
     * @return Returns the found {@code Service}.
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
     * Gets the description of the package that will be placed in the
     * "description" field of the generated package.json.
     *
     * @return Returns the description.
     */
    public String getPackageDescription() {
        return packageDescription;
    }

    public void setPackageDescription(String packageDescription) {
        this.packageDescription = packageDescription;
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
     *
     * @return Returns the custom package JSON.
     */
    public ObjectNode getPackageJson() {
        return packageJson;
    }

    public void setPackageJson(ObjectNode packageJson) {
        this.packageJson = packageJson;
    }
}
