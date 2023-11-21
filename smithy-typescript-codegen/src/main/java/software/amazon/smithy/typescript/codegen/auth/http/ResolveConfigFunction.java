/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http;

import java.util.Optional;
import software.amazon.smithy.codegen.core.Symbol;
import software.amazon.smithy.utils.SmithyBuilder;
import software.amazon.smithy.utils.SmithyUnstableApi;
import software.amazon.smithy.utils.ToSmithyBuilder;

/**
 * ResolveConfigFunction.
 */
@SmithyUnstableApi
public final record ResolveConfigFunction(
    Symbol resolveConfigFunction,
    Symbol inputConfig,
    Symbol resolvedConfig,
    Optional<Symbol> previouslyResolved
) implements ToSmithyBuilder<ResolveConfigFunction> {

    public static Builder builder() {
        return new Builder();
    }

    @Override
    public Builder toBuilder() {
        return builder()
            .resolveConfigFunction(resolveConfigFunction)
            .inputConfig(inputConfig)
            .resolvedConfig(resolvedConfig)
            .previouslyResolved(previouslyResolved.orElse(null));
    }

    public static final class Builder implements SmithyBuilder<ResolveConfigFunction> {
        private Symbol resolveConfigFunction;
        private Symbol inputConfig;
        private Symbol resolvedConfig;
        private Symbol previouslyResolved;

        @Override
        public ResolveConfigFunction build() {
            return new ResolveConfigFunction(
                SmithyBuilder.requiredState("resolveConfigFunction", resolveConfigFunction),
                SmithyBuilder.requiredState("inputConfig", inputConfig),
                SmithyBuilder.requiredState("resolvedConfig", resolvedConfig),
                Optional.ofNullable(previouslyResolved));
        }

        public Builder resolveConfigFunction(Symbol resolveConfigFunction) {
            this.resolveConfigFunction = resolveConfigFunction;
            return this;
        }

        public Builder inputConfig(Symbol inputConfig) {
            this.inputConfig = inputConfig;
            return this;
        }

        public Builder resolvedConfig(Symbol resolvedConfig) {
            this.resolvedConfig = resolvedConfig;
            return this;
        }

        public Builder previouslyResolved(Symbol previouslyResolved) {
            this.previouslyResolved = previouslyResolved;
            return this;
        }
    }
}
