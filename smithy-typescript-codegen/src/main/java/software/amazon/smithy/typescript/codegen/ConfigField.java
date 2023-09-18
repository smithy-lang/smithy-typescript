/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen;

import java.util.function.Consumer;
import software.amazon.smithy.utils.SmithyBuilder;
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
    Consumer<TypeScriptWriter> inputType,
    Consumer<TypeScriptWriter> resolvedType,
    Consumer<TypeScriptWriter> docs
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
            .docs(docs);
    }

    public static final class Builder implements SmithyBuilder<ConfigField> {
        private String name;
        private Type type;
        private Consumer<TypeScriptWriter> inputType;
        private Consumer<TypeScriptWriter> resolvedType;
        private Consumer<TypeScriptWriter> docs;

        @Override
        public ConfigField build() {
            return new ConfigField(
                SmithyBuilder.requiredState("name", name),
                SmithyBuilder.requiredState("type", type),
                SmithyBuilder.requiredState("inputType", inputType),
                SmithyBuilder.requiredState("resolvedType", resolvedType),
                SmithyBuilder.requiredState("docs", docs));
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
    }
}
