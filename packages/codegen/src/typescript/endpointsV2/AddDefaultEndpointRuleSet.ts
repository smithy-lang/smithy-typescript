import type { SymbolProvider } from "../../codegen-core";
import { EndpointRuleSetTrait, type Model, ModelTransformer } from "../../model";
import { CodegenUtils } from "../CodegenUtils";
import { AddBuiltinPlugins } from "../integration/AddBuiltinPlugins";
import { RuntimeClientPlugin } from "../integration/RuntimeClientPlugin";
import { TypeScriptIntegration } from "../integration/TypeScriptIntegration";
import { LanguageTarget } from "../LanguageTarget";
import { TypeScriptDependency } from "../TypeScriptDependency";
import type { TypeScriptSettings } from "../TypeScriptSettings";
import type { TypeScriptWriter } from "../TypeScriptWriter";

const DEFAULT_RULESET = new EndpointRuleSetTrait({
  version: "1.0",
  parameters: {
    endpoint: {
      type: "string",
      builtIn: "SDK::Endpoint",
      documentation: "Endpoint used for making requests. Should be formatted as a URI.",
    },
  },
  rules: [
    {
      conditions: [{ fn: "isSet", argv: [{ ref: "endpoint" }] }],
      endpoint: { url: { ref: "endpoint" } },
      type: "endpoint",
    },
    {
      conditions: [],
      error: "(default endpointRuleSet) endpoint is not set - you must configure an endpoint.",
      type: "error",
    },
  ],
});

/**
 * Adds endpoint config resolution and the endpoint provider runtime config.
 */
export class AddDefaultEndpointRuleSet extends TypeScriptIntegration {
  private _usesDefaultEndpointRuleset = false;

  public runAfter(): string[] {
    return [new AddBuiltinPlugins().name()];
  }

  public getClientPlugins(): RuntimeClientPlugin[] {
    const version = TypeScriptDependency.SMITHY_CORE.dependency.getVersion();
    const endpointConfigResolver = RuntimeClientPlugin.builder()
      .withConventions("@smithy/core/endpoints", version, "Endpoint", "HAS_CONFIG")
      .build();
    if (this._usesDefaultEndpointRuleset) {
      return [
        endpointConfigResolver,
        RuntimeClientPlugin.builder()
          .withConventions("@smithy/core/endpoints", version, "EndpointRequired", "HAS_CONFIG")
          .build(),
      ];
    }
    return [endpointConfigResolver];
  }

  public preprocessModel(model: Model, settings: TypeScriptSettings): Model {
    if (settings.getOptionalService() === undefined) {
      return model;
    }
    const service = settings.getService(model);
    if (service.hasTrait(EndpointRuleSetTrait)) {
      return model;
    }
    this._usesDefaultEndpointRuleset = true;
    return ModelTransformer.create().addServiceTrait(model, service, DEFAULT_RULESET);
  }

  public getRuntimeConfigWriters(
    settings: TypeScriptSettings,
    _model: Model,
    _symbolProvider: SymbolProvider,
    target: LanguageTarget
  ): Map<string, (writer: TypeScriptWriter) => void> {
    if (!settings.generateClient() || target !== LanguageTarget.SHARED) {
      return new Map();
    }
    return new Map([
      [
        "endpointProvider",
        (writer) => {
          writer.addImport(
            "defaultEndpointResolver",
            null,
            "./" + [CodegenUtils.SOURCE_FOLDER, "endpoint/endpointResolver"].join("/")
          );
          writer.write("defaultEndpointResolver");
        },
      ],
    ]);
  }
}
