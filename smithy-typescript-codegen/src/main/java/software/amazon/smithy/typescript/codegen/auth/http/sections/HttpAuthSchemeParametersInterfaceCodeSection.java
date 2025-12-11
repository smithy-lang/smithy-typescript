/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package software.amazon.smithy.typescript.codegen.auth.http.sections;

import java.util.Map;
import software.amazon.smithy.codegen.core.SymbolProvider;
import software.amazon.smithy.model.Model;
import software.amazon.smithy.model.shapes.ServiceShape;
import software.amazon.smithy.typescript.codegen.TypeScriptSettings;
import software.amazon.smithy.typescript.codegen.auth.http.HttpAuthSchemeParameter;
import software.amazon.smithy.utils.CodeSection;
import software.amazon.smithy.utils.SmithyBuilder;
import software.amazon.smithy.utils.SmithyInternalApi;

@SmithyInternalApi
public final class HttpAuthSchemeParametersInterfaceCodeSection implements CodeSection {
  private final ServiceShape service;
  private final TypeScriptSettings settings;
  private final Model model;
  private final SymbolProvider symbolProvider;
  private final Map<String, HttpAuthSchemeParameter> httpAuthSchemeParameters;

  private HttpAuthSchemeParametersInterfaceCodeSection(Builder builder) {
    service = SmithyBuilder.requiredState("service", builder.service);
    settings = SmithyBuilder.requiredState("settings", builder.settings);
    model = SmithyBuilder.requiredState("model", builder.model);
    symbolProvider = SmithyBuilder.requiredState("symbolProvider", builder.symbolProvider);
    httpAuthSchemeParameters =
        SmithyBuilder.requiredState("httpAuthSchemeParameters", builder.httpAuthSchemeParameters);
  }

  public ServiceShape getService() {
    return service;
  }

  public TypeScriptSettings getSettings() {
    return settings;
  }

  public Model getModel() {
    return model;
  }

  public SymbolProvider getSymbolProvider() {
    return symbolProvider;
  }

  public Map<String, HttpAuthSchemeParameter> getHttpAuthSchemeParameters() {
    return httpAuthSchemeParameters;
  }

  public static Builder builder() {
    return new Builder();
  }

  public static class Builder
      implements SmithyBuilder<HttpAuthSchemeParametersInterfaceCodeSection> {
    private ServiceShape service;
    private TypeScriptSettings settings;
    private Model model;
    private SymbolProvider symbolProvider;
    private Map<String, HttpAuthSchemeParameter> httpAuthSchemeParameters;

    @Override
    public HttpAuthSchemeParametersInterfaceCodeSection build() {
      return new HttpAuthSchemeParametersInterfaceCodeSection(this);
    }

    public Builder service(ServiceShape service) {
      this.service = service;
      return this;
    }

    public Builder settings(TypeScriptSettings settings) {
      this.settings = settings;
      return this;
    }

    public Builder model(Model model) {
      this.model = model;
      return this;
    }

    public Builder symbolProvider(SymbolProvider symbolProvider) {
      this.symbolProvider = symbolProvider;
      return this;
    }

    public Builder httpAuthSchemeParameters(
        Map<String, HttpAuthSchemeParameter> httpAuthSchemeParameters) {
      this.httpAuthSchemeParameters = httpAuthSchemeParameters;
      return this;
    }
  }
}
