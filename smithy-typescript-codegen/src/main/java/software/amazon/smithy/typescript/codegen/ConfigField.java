/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen;

import java.util.Optional;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.CodegenException;
import software.amazon.smithy.utils.SmithyBuilder;
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.utils.SmithyUnstableApi;
import software.amazon.smithy.utils.ToSmithyBuilder;

/**
 * Definition of a Config field.
 *
 * Currently used to populate the ClientDefaults interface in `experimentalIdentityAndAuth`.
 *
 * @param name name of the config field
 * @param type whether the config field is main or auxiliary
 * @param inputType writer for the input type of the config field
 * @param resolvedType writer for the resolved type of the config field
 * @param docs writer for the docs of the config field
 */
@SmithyUnstableApi
public final record ConfigField(
    String name,
    Type type,
    Optional<Consumer<TypeScriptWriter>> inputType,
    Optional<Consumer<TypeScriptWriter>> resolvedType,
    Optional<Consumer<TypeScriptWriter>> docs,
    Optional<BiConsumer<TypeScriptWriter, ConfigField>> configFieldWriter
) implements ToSmithyBuilder<ConfigField> {

    public ConfigField {
        switch (type) {
            case MAIN:
            case AUXILIARY:
                String typeName = type.equals(Type.MAIN) ? "Main" : "Auxiliary";
                if (inputType.isEmpty() || resolvedType.isEmpty()) {
                    throw new CodegenException(
                        typeName
                        + "ConfigField `"
                        + name
                        + "` is invalid, requires inputType, resolvedType, docs, and configFieldWriter to be defined");
                }
                break;
            case PREVIOUSLY_RESOLVED:
                if (resolvedType.isEmpty()) {
                    throw new CodegenException(
                        "Previously Resolved ConfigField `"
                        + name
                        + "` is invalid, requires resolvedType");
                }
                break;
            default:
                throw new CodegenException("ConfigField Type is not recognized");
        }
    }

    /**
     * Defines the type of the config field.
     */
    @SmithyUnstableApi
    public enum Type {
        /**
         * Specifies the property is important, e.g. {@code apiKey} for {@code @httpApiKeyAuth}
         */
        MAIN,
        /**
         * Specifies the property is auxiliary, e.g. {@code region} for {@code @aws.auth#sigv4}
         */
        AUXILIARY,
        /**
         * Specifies the property is previously resolved, e.g. in {@code resolve*Config} functions
         */
        PREVIOUSLY_RESOLVED,
    }

    public static Builder builder() {
        return new Builder();
    }

    @Override
    public Builder toBuilder() {
        return builder()
            .name(name)
            .type(type)
            .inputType(inputType.orElse(null))
            .resolvedType(resolvedType.orElse(null))
            .docs(docs.orElse(null))
            .configFieldWriter(configFieldWriter.orElse(null));
    }

    public static final class Builder implements SmithyBuilder<ConfigField> {
        private String name;
        private Type type;
        private Consumer<TypeScriptWriter> inputType;
        private Consumer<TypeScriptWriter> resolvedType;
        private Consumer<TypeScriptWriter> docs;
        private BiConsumer<TypeScriptWriter, ConfigField> configFieldWriter;

        @Override
        public ConfigField build() {
            return new ConfigField(
                SmithyBuilder.requiredState("name", name),
                SmithyBuilder.requiredState("type", type),
                Optional.ofNullable(inputType),
                Optional.ofNullable(resolvedType),
                Optional.ofNullable(docs),
                Optional.ofNullable(configFieldWriter));
        }

        public Builder name(String name) {
            this.name = name;
            return this;
        }

        public Builder type(Type type) {
            this.type = type;
            return this;
        }

        public Builder inputType(Consumer<TypeScriptWriter> inputType) {
            this.inputType = inputType;
            return this;
        }

        public Builder resolvedType(Consumer<TypeScriptWriter> resolvedType) {
            this.resolvedType = resolvedType;
            return this;
        }

        public Builder docs(Consumer<TypeScriptWriter> docs) {
            this.docs = docs;
            return this;
        }

        public Builder configFieldWriter(BiConsumer<TypeScriptWriter, ConfigField> configFieldWriter) {
            this.configFieldWriter = configFieldWriter;
            return this;
        }
    }

    @SmithyInternalApi
    public static void writeDefaultMainConfigField(
        TypeScriptWriter w,
        ConfigField configField
    ) {
        w.addDependency(TypeScriptDependency.SMITHY_CORE);
        w.addImport("memoizeIdentityProvider", null,
            TypeScriptDependency.SMITHY_CORE);
        w.addImport("isIdentityExpired", null,
            TypeScriptDependency.SMITHY_CORE);
        w.addImport("doesIdentityRequireRefresh", null,
            TypeScriptDependency.SMITHY_CORE);
        w.write("""
            const $L = memoizeIdentityProvider(config.$L, isIdentityExpired, \
            doesIdentityRequireRefresh);""",
            configField.name(),
            configField.name());
    }

    @SmithyInternalApi
    public static void writeDefaultAuxiliaryConfigField(
        TypeScriptWriter w,
        ConfigField configField
    ) {
        w.addDependency(TypeScriptDependency.UTIL_MIDDLEWARE);
        w.addImport("normalizeProvider", null, TypeScriptDependency.UTIL_MIDDLEWARE);
        w.write("const $L = config.$L ? normalizeProvider(config.$L) : undefined;",
            configField.name(),
            configField.name(),
            configField.name());
    }
}
