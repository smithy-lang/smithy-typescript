/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.sections;

import java.util.List;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.typescript.codegen.integration.RuntimeClientPlugin;
import software.amazon.smithy.utils.CodeSection;
import software.amazon.smithy.utils.SmithyBuilder;
import software.amazon.smithy.utils.SmithyUnstableApi;

@SmithyUnstableApi
public final class ClientConstructorCodeSection implements CodeSection {
  private final ServiceShape service;
  private final List<RuntimeClientPlugin> runtimeClientPlugins;
  private final Model model;

  private ClientConstructorCodeSection(Builder builder) {
    service = SmithyBuilder.requiredState("service", builder.service);
    runtimeClientPlugins =
        SmithyBuilder.requiredState("runtimePlugins", builder.runtimeClientPlugins);
    model = SmithyBuilder.requiredState("model", builder.model);
  }

  public static Builder builder() {
    return new Builder();
  }

  public ServiceShape getService() {
    return service;
  }

  public List<RuntimeClientPlugin> getRuntimeClientPlugins() {
    return runtimeClientPlugins;
  }

  public Model getModel() {
    return model;
  }

  public static class Builder implements SmithyBuilder<ClientConstructorCodeSection> {
    private ServiceShape service;
    private List<RuntimeClientPlugin> runtimeClientPlugins;
    private Model model;

    @Override
    public ClientConstructorCodeSection build() {
      return new ClientConstructorCodeSection(this);
    }

    public Builder service(ServiceShape service) {
      this.service = service;
      return this;
    }

    public Builder runtimeClientPlugins(List<RuntimeClientPlugin> runtimeClientPlugins) {
      this.runtimeClientPlugins = runtimeClientPlugins;
      return this;
    }

    public Builder model(Model model) {
      this.model = model;
      return this;
    }
  }
}
