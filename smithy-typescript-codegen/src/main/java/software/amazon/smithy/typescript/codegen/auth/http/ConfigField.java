/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http;

import java.util.Optional;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.typescript.codegen.TypeScriptDependency;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.SmithyBuilder;
import software.amazon.smithy.utils.SmithyInternalApi;
import software.amazon.smithy.utils.SmithyUnstableApi;
import software.amazon.smithy.utils.ToSmithyBuilder;

/**
 * Definition of a Config field.
 *
 * Currently used to populate the ClientDefaults interface.
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
    Symbol inputType,
    Symbol resolvedType,
    Optional<BiConsumer<TypeScriptWriter, ConfigField>> configFieldWriter,
    Optional<Consumer<TypeScriptWriter>> docs
) implements ToSmithyBuilder<ConfigField> {

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
        AUXILIARY
    }

    public static Builder builder() {
        return new Builder();
    }

    @Override
    public Builder toBuilder() {
        return builder()
            .name(name)
            .type(type)
            .inputType(inputType)
            .resolvedType(resolvedType)
            .configFieldWriter(configFieldWriter.orElse(null))
            .docs(docs.orElse(null));
    }

    public static final class Builder implements SmithyBuilder<ConfigField> {
        private String name;
        private Type type;
        private Symbol inputType;
        private Symbol resolvedType;
        private Consumer<TypeScriptWriter> docs;
        private BiConsumer<TypeScriptWriter, ConfigField> configFieldWriter;

        @Override
        public ConfigField build() {
            return new ConfigField(
                SmithyBuilder.requiredState("name", name),
                SmithyBuilder.requiredState("type", type),
                SmithyBuilder.requiredState("inputType", inputType),
                SmithyBuilder.requiredState("resolvedType", resolvedType),
                Optional.ofNullable(configFieldWriter),
                Optional.ofNullable(docs));
        }

        public Builder name(String name) {
            this.name = name;
            return this;
        }

        public Builder type(Type type) {
            this.type = type;
            return this;
        }

        public Builder inputType(Symbol inputType) {
            this.inputType = inputType;
            return this;
        }

        public Builder resolvedType(Symbol resolvedType) {
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
    public static void defaultMainConfigFieldWriter(
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
    public static void defaultAuxiliaryConfigFieldWriter(
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
