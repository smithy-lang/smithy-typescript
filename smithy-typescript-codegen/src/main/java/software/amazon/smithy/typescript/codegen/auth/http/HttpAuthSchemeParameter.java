/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http;

import java.util.function.Consumer;
import software.amazon.smithy.typescript.codegen.TypeScriptWriter;
import software.amazon.smithy.utils.SmithyBuilder;
import software.amazon.smithy.utils.SmithyUnstableApi;
import software.amazon.smithy.utils.ToSmithyBuilder;

/**
 * Definition of an HttpAuthSchemeParameter.
 *
 * Currently this is used to generate the the HttpAuthSchemeParameters interface.
 *
 * @param name name of the auth scheme parameter
 * @param type writer for the type of the auth scheme parameter
 * @param source writer for the value of the auth scheme parameter, typically from {@code context} or {@code config}
 */
@SmithyUnstableApi
public record HttpAuthSchemeParameter(
    String name,
    Consumer<TypeScriptWriter> type,
    Consumer<TypeScriptWriter> source
) implements ToSmithyBuilder<HttpAuthSchemeParameter> {
    public static Builder builder() {
        return new Builder();
    }

    @Override
    public SmithyBuilder<HttpAuthSchemeParameter> toBuilder() {
        return builder().name(name).type(type).source(source);
    }

    public static final class Builder implements SmithyBuilder<HttpAuthSchemeParameter> {

        private String name;
        private Consumer<TypeScriptWriter> type;
        private Consumer<TypeScriptWriter> source;

        @Override
        public HttpAuthSchemeParameter build() {
            return new HttpAuthSchemeParameter(
                SmithyBuilder.requiredState("name", name),
                SmithyBuilder.requiredState("type", type),
                SmithyBuilder.requiredState("source", source)
            );
        }

        public Builder name(String name) {
            this.name = name;
            return this;
        }

        public Builder type(Consumer<TypeScriptWriter> type) {
            this.type = type;
            return this;
        }

        public Builder source(Consumer<TypeScriptWriter> source) {
            this.source = source;
            return this;
        }
    }
}
