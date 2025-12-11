/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.sections;

import java.util.List;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.typescript.codegen.ApplicationProtocol;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.integration.TypeScriptIntegration;
import software.amazon.smithy.utils.CodeSection;
import software.amazon.smithy.utils.SmithyBuilder;
import software.amazon.smithy.utils.SmithyUnstableApi;

@SmithyUnstableApi
public final class ClientPropertiesCodeSection implements CodeSection {
  private final TypeScriptSettings settings;
  private final Model model;
  private final ServiceShape service;
  private final SymbolProvider symbolProvider;
  private final List<TypeScriptIntegration> integrations;
  private final ApplicationProtocol applicationProtocol;

  private ClientPropertiesCodeSection(Builder builder) {
    settings = SmithyBuilder.requiredState("settings", builder.settings);
    model = SmithyBuilder.requiredState("model", builder.model);
    service = SmithyBuilder.requiredState("service", builder.service);
    symbolProvider = SmithyBuilder.requiredState("symbolProvider", builder.symbolProvider);
    integrations = SmithyBuilder.requiredState("integrations", builder.integrations);
    applicationProtocol =
        SmithyBuilder.requiredState("applicationProtocol", builder.applicationProtocol);
  }

  public static Builder builder() {
    return new Builder();
  }

  public TypeScriptSettings getSettings() {
    return settings;
  }

  public Model getModel() {
    return model;
  }

  public ServiceShape getService() {
    return service;
  }

  public SymbolProvider getSymbolProvider() {
    return symbolProvider;
  }

  public List<TypeScriptIntegration> getIntegrations() {
    return integrations;
  }

  public ApplicationProtocol getApplicationProtocol() {
    return applicationProtocol;
  }

  public static class Builder implements SmithyBuilder<ClientPropertiesCodeSection> {
    private TypeScriptSettings settings;
    private Model model;
    private ServiceShape service;
    private SymbolProvider symbolProvider;
    private List<TypeScriptIntegration> integrations;
    private ApplicationProtocol applicationProtocol;

    @Override
    public ClientPropertiesCodeSection build() {
      return new ClientPropertiesCodeSection(this);
    }

    public Builder settings(TypeScriptSettings settings) {
      this.settings = settings;
      return this;
    }

    public Builder model(Model model) {
      this.model = model;
      return this;
    }

    public Builder service(ServiceShape service) {
      this.service = service;
      return this;
    }

    public Builder symbolProvider(SymbolProvider symbolProvider) {
      this.symbolProvider = symbolProvider;
      return this;
    }

    public Builder integrations(List<TypeScriptIntegration> integrations) {
      this.integrations = integrations;
      return this;
    }

    public Builder applicationProtocol(ApplicationProtocol applicationProtocol) {
      this.applicationProtocol = applicationProtocol;
      return this;
    }
  }
}
