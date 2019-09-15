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
import java.util.Locale;
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

    private static final String PACKAGE = "package";
    private static final String TARGET = "target";
    private static final String SERVICE = "service";

    private String packageName;
    private ShapeId service;
    private TypeScriptCodegenPlugin.Target environment;
    private ObjectNode pluginSettings = Node.objectNode();

    /**
     * Create a settings object from a configuration object node.
     *
     * @param config Config object to load.
     * @return Returns the extracted settings.
     */
    public static TypeScriptSettings from(ObjectNode config) {
        TypeScriptSettings settings = new TypeScriptSettings();
        config.warnIfAdditionalProperties(Arrays.asList(PACKAGE, TARGET, SERVICE));
        settings.setPackageName(config.expectStringMember(PACKAGE).getValue());
        settings.setEnvironment(TypeScriptCodegenPlugin.Target.valueOf(
                config.expectStringMember(TARGET).getValue().toUpperCase(Locale.ENGLISH)));
        settings.setService(config.expectStringMember(SERVICE).expectShapeId());
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
     * Gets the target environment that is being generated for.
     *
     * @return Returns the target JavaScript environment.
     */
    public TypeScriptCodegenPlugin.Target getEnvironment() {
        return Objects.requireNonNull(environment, TARGET + " not set");
    }

    public void setEnvironment(TypeScriptCodegenPlugin.Target environment) {
        this.environment = environment;
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
}
