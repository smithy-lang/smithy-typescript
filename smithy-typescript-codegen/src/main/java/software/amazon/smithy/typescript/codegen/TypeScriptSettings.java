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
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.BiFunction;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.knowledge.ServiceIndex;
import software.amazon.smithy.model.node.BooleanNode;
import software.amazon.smithy.model.node.Node;
import software.amazon.smithy.model.node.ObjectNode;
import software.amazon.smithy.model.node.StringNode;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.model.shapes.Shape;
import software.amazon.smithy.model.shapes.ShapeId;
import software.amazon.smithy.model.traits.DefaultTrait;
import software.amazon.smithy.model.traits.RequiredTrait;
import software.amazon.smithy.utils.SmithyUnstableApi;

/**
 * Settings used by {@link TypeScriptCodegenPlugin}.
 */
@SmithyUnstableApi
public final class TypeScriptSettings {

    static final String DISABLE_DEFAULT_VALIDATION = "disableDefaultValidation";
    static final String REQUIRED_MEMBER_MODE = "requiredMemberMode";
    private static final Logger LOGGER = Logger.getLogger(TypeScriptSettings.class.getName());

    private static final String PACKAGE = "package";
    private static final String PACKAGE_DESCRIPTION = "packageDescription";
    private static final String PACKAGE_VERSION = "packageVersion";
    private static final String PACKAGE_JSON = "packageJson";
    private static final String SERVICE = "service";
    private static final String PROTOCOL = "protocol";
    private static final String PRIVATE = "private";
    private static final String PACKAGE_MANAGER = "packageManager";
    private static final String CREATE_DEFAULT_README = "createDefaultReadme";
    private static final String EXPERIMENTAL_IDENTITY_AND_AUTH = "experimentalIdentityAndAuth";
    private static final String GENERATE_TYPEDOC = "generateTypeDoc";

    private String packageName;
    private String packageDescription = "";
    private String packageVersion;
    private ObjectNode packageJson = Node.objectNode();
    private ShapeId service;
    private ObjectNode pluginSettings = Node.objectNode();
    private ShapeId protocol;
    private String defaultSigningName = "";
    private boolean isPrivate;
    private ArtifactType artifactType = ArtifactType.CLIENT;
    private boolean disableDefaultValidation = false;
    private RequiredMemberMode requiredMemberMode =
        RequiredMemberMode.NULLABLE;
    private PackageManager packageManager = PackageManager.YARN;
    private boolean createDefaultReadme = false;
    private boolean experimentalIdentityAndAuth = false;
    private boolean generateTypeDoc = false;

    @Deprecated
    public static TypeScriptSettings from(Model model, ObjectNode config) {
        return from(model, config, ArtifactType.CLIENT);
    }

    /**
     * Create a settings object from a configuration object node.
     *
     * @param model Model to infer the service to generate if not explicitly provided.
     * @param config Config object to load.
     * @param artifactType The type of artifact being generated.
     * @return Returns the extracted settings.
     */
    public static TypeScriptSettings from(Model model, ObjectNode config, ArtifactType artifactType) {
        TypeScriptSettings settings = new TypeScriptSettings();
        settings.setArtifactType(artifactType);
        config.warnIfAdditionalProperties(artifactType.configProperties);

        // Get the service from the settings or infer one from the given model.
        settings.setService(config.getStringMember(SERVICE)
                .map(StringNode::expectShapeId)
                .orElseGet(() -> inferService(model)));

        settings.setPackageName(config.expectStringMember(PACKAGE).getValue());
        settings.setPackageVersion(config.expectStringMember(PACKAGE_VERSION).getValue());
        settings.setPackageDescription(config.getStringMemberOrDefault(
                PACKAGE_DESCRIPTION, settings.getDefaultDescription()));
        settings.packageJson = config.getObjectMember(PACKAGE_JSON).orElse(Node.objectNode());
        config.getStringMember(PROTOCOL).map(StringNode::getValue).map(ShapeId::from).ifPresent(settings::setProtocol);
        settings.setPrivate(config.getBooleanMember(PRIVATE).map(BooleanNode::getValue).orElse(false));
        settings.setCreateDefaultReadme(
                config.getBooleanMember(CREATE_DEFAULT_README).map(BooleanNode::getValue).orElse(false));
        settings.setExperimentalIdentityAndAuth(
                config.getBooleanMemberOrDefault(EXPERIMENTAL_IDENTITY_AND_AUTH, false));
        settings.setGenerateTypeDoc(
                config.getBooleanMember(GENERATE_TYPEDOC).map(BooleanNode::getValue).orElse(false));
        settings.setPackageManager(
                config.getStringMember(PACKAGE_MANAGER)
                    .map(s -> PackageManager.fromString(s.getValue()))
                    .orElse(PackageManager.YARN));

        if (artifactType == ArtifactType.SSDK) {
            settings.setDisableDefaultValidation(config.getBooleanMemberOrDefault(DISABLE_DEFAULT_VALIDATION));
        }
        settings.setRequiredMemberMode(
            config.getStringMember(REQUIRED_MEMBER_MODE)
                .map(s -> RequiredMemberMode.fromString(s.getValue()))
                .orElse(RequiredMemberMode.NULLABLE));

        settings.setPluginSettings(config);
        return settings;
    }

    private String getDefaultDescription() {
        String description = getPackageName();
        switch (artifactType) {
            case CLIENT:
                description += " client";
                break;
            case SSDK:
                description += " server";
                break;
            default:
        }
        return description;
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

    public boolean createDefaultReadme() {
        return createDefaultReadme;
    }

    public void setCreateDefaultReadme(boolean createDefaultReadme) {
        this.createDefaultReadme = createDefaultReadme;
    }

    /**
     * Returns if the generated package will be a client.
     *
     * @return If the package will include a client.
     */
    public boolean generateClient() {
        return artifactType.equals(ArtifactType.CLIENT);
    }

    /**
     * Returns if the generated package will be a server sdk.
     *
     * @return If the package will include a server sdk.
     */
    public boolean generateServerSdk() {
        return artifactType.equals(ArtifactType.SSDK);
    }

    /**
     * Returns the type of artifact being generated, such as a client or ssdk.
     *
     * @return The artifact type.
     */
    public ArtifactType getArtifactType() {
        return artifactType;
    }

    public void setArtifactType(ArtifactType artifactType) {
        this.artifactType = artifactType;
    }

    /**
     * Returns whether or not default validation is disabled. This setting is only relevant for the SSDK.
     *
     * @return true if default validation is disabled. Default: false
     */
    public boolean isDisableDefaultValidation() {
        return disableDefaultValidation;
    }

    public void setDisableDefaultValidation(boolean disableDefaultValidation) {
        this.disableDefaultValidation = disableDefaultValidation;
    }

    /**
     * Returns the code generation mode for required members.
     *
     * @return the configured mode for required members.
     * Defaults to {@link RequiredMemberMode#NULLABLE}
     */
    public RequiredMemberMode getRequiredMemberMode() {
        return requiredMemberMode;
    }

    public void setRequiredMemberMode(
        RequiredMemberMode requiredMemberMode) {
            if (requiredMemberMode != RequiredMemberMode.NULLABLE) {
                LOGGER.warning(String.format("By setting the required member mode to '%s', a"
                    + " member that has the '@required' trait applied CANNOT be 'undefined'."
                    + " It will be considered a BACKWARDS INCOMPATIBLE change for"
                    + " Smithy services even when the required constraint is dropped from a member.",
                    requiredMemberMode.mode, RequiredMemberMode.NULLABLE.mode));
            }
            this.requiredMemberMode = requiredMemberMode;
    }

    /**
     * Returns the package manager used by the generated package.
     *
     * @return the configured package manager. Defaults to {@link PackageManager#YARN}
     */
    public PackageManager getPackageManager() {
        return packageManager;
    }

    public void setPackageManager(PackageManager packageManager) {
        this.packageManager = packageManager;
    }

    /**
     * Returns whether to use experimental identity and auth.
     *
     * @return if experimental identity and auth should used. Default: false
     */
    public boolean getExperimentalIdentityAndAuth() {
        return experimentalIdentityAndAuth;
    }

    /**
     * Sets whether experimental identity and auth should be used.
     *
     * @param experimentalIdentityAndAuth whether experimental identity and auth should be used.
     */
    public void setExperimentalIdentityAndAuth(boolean experimentalIdentityAndAuth) {
        if (experimentalIdentityAndAuth) {
            LOGGER.warning("""
                Experimental identity and auth is in development, and is subject to \
                breaking changes. Behavior may NOT have the same feature parity as \
                non-experimental behavior. This setting is also subject to removal \
                when the feature is completed.""");
        }
        this.experimentalIdentityAndAuth = experimentalIdentityAndAuth;
    }

    /**
     * Returns whether to generate typedoc support.
     *
     * @return whether to generate typedoc support. Default: false
     */
    public boolean generateTypeDoc() {
        return generateTypeDoc;
    }

    /**
     * Sets whether to generate typedoc support.
     *
     * @param generateTypeDoc whether to generate typedoc support
     */
    public void setGenerateTypeDoc(boolean generateTypeDoc) {
        this.generateTypeDoc = generateTypeDoc;
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

    /**
     * @param name - used as the signing service name when no explicit value from endpoints AuthScheme is present.
     */
    public void setDefaultSigningName(String name) {
        defaultSigningName = name;
    }

    /**
     * @return signing service name when no explicit value from endpoints AuthScheme is present.
     */
    public String getDefaultSigningName() {
        return defaultSigningName;
    }

    /**
     * An enum indicating the type of artifact the code generator will produce.
     */
    public enum ArtifactType {
        CLIENT(SymbolVisitor::new,
                Arrays.asList(PACKAGE, PACKAGE_DESCRIPTION, PACKAGE_JSON, PACKAGE_VERSION, PACKAGE_MANAGER,
                              SERVICE, PROTOCOL, PRIVATE, REQUIRED_MEMBER_MODE,
                              CREATE_DEFAULT_README, EXPERIMENTAL_IDENTITY_AND_AUTH, GENERATE_TYPEDOC)),
        SSDK((m, s) -> new ServerSymbolVisitor(m, new SymbolVisitor(m, s)),
                Arrays.asList(PACKAGE, PACKAGE_DESCRIPTION, PACKAGE_JSON, PACKAGE_VERSION, PACKAGE_MANAGER,
                              SERVICE, PROTOCOL, PRIVATE, REQUIRED_MEMBER_MODE,
                              DISABLE_DEFAULT_VALIDATION, CREATE_DEFAULT_README, GENERATE_TYPEDOC));

        private final BiFunction<Model, TypeScriptSettings, SymbolProvider> symbolProviderFactory;
        private final List<String> configProperties;

        ArtifactType(BiFunction<Model, TypeScriptSettings, SymbolProvider> symbolProviderFactory,
                     List<String> configProperties) {
            this.symbolProviderFactory = symbolProviderFactory;
            this.configProperties = Collections.unmodifiableList(configProperties);
        }

        /**
         * Creates a TypeScript symbol provider suited to the artifact type.
         *
         * @param model Model to generate symbols for.
         * @param settings Settings used by the symbol provider.
         * @return Returns the created provider.
         */
        public SymbolProvider createSymbolProvider(Model model, TypeScriptSettings settings) {
            return symbolProviderFactory.apply(model, settings);
        }
    }

    /**
     * An enum indicating the code generation mode for required members.
     */
    public enum RequiredMemberMode {
        /**
         * This is the current behavior and it will be the default. When set,
         * it allows a member that has the {@link RequiredTrait} applied to be {@code undefined}.
         * By doing so it can still be considered a backwards compatible change fo
         * Smithy services even when the required constraint is dropped from a member.
         */
        NULLABLE("nullable"),

        /**
         * This will dissallow members marked as {@link RequiredTrait} to be {@code undefined}.
         * Use this mode with CAUTION because it comes with certain risks. When a server drops
         * {@link RequiredTrait} from an output shape (and it is replaced with {@link DefaultTrait}
         * as defined by the spec), if the server does not always serialize a value,
         * customer code consuming the client and trying to access this member, may get a
         * NullPointerException. Smithy spec says: "Authoritative model consumers like servers
         * SHOULD always serialize default values to remove any ambiguity about the value of
         * the most up to default value." So one should use this mode on the client, only if
         * the server is following the approach proposed by the spec.
         */
        STRICT("strict");

        private final String mode;

        RequiredMemberMode(String mode) {
            this.mode = mode;
        }

        public String getMode() {
            return mode;
        }

        public static RequiredMemberMode fromString(String s) {
            if ("nullable".equals(s)) {
                return NULLABLE;
            }
            if ("strict".equals(s)) {
                return STRICT;
            }
            throw new CodegenException(String.format("Unsupported required member mode: %s", s));
        }
    }

    public enum PackageManager {
        YARN("yarn"),
        NPM("npm");

        private final String command;

        PackageManager(String command) {
            this.command = command;
        }

        public String getCommand() {
            return command;
        }

        public static PackageManager fromString(String s) {
            if ("yarn".equals(s)) {
                return YARN;
            }
            if ("npm".equals(s)) {
                return NPM;
            }
            throw new CodegenException(String.format("Unsupported package manager: %s", s));
        }
    }
}
