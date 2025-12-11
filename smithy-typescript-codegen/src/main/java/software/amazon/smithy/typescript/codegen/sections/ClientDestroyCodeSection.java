/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.sections;

import java.util.List;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.utils.CodeSection;
import software.amazon.smithy.utils.SmithyBuilder;
import software.amazon.smithy.utils.SmithyUnstableApi;

@SmithyUnstableApi
public final class ClientDestroyCodeSection implements CodeSection {

    private final List<RuntimeClientPlugin> runtimeClientPlugins;

    private ClientDestroyCodeSection(Builder builder) {
        runtimeClientPlugins = SmithyBuilder.requiredState("runtimePlugins", builder.runtimeClientPlugins);
    }

    public static Builder builder() {
        return new Builder();
    }

    public List<RuntimeClientPlugin> getRuntimeClientPlugins() {
        return runtimeClientPlugins;
    }

    public static class Builder implements SmithyBuilder<ClientDestroyCodeSection> {

        private List<RuntimeClientPlugin> runtimeClientPlugins;

        @Override
        public ClientDestroyCodeSection build() {
            return new ClientDestroyCodeSection(this);
        }

        public Builder runtimeClientPlugins(List<RuntimeClientPlugin> runtimeClientPlugins) {
            this.runtimeClientPlugins = runtimeClientPlugins;
            return this;
        }
    }
}
