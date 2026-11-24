import type { SymbolProvider } from "../codegen-core";
import type { Model, ServiceShape } from "../model";
import { CodegenUtils } from "./CodegenUtils";
import type { Dependency } from "./Dependency";
import type { TypeScriptIntegration } from "./integration/TypeScriptIntegration";
import type { TypeScriptDelegator } from "./TypeScriptDelegator";
import type { TypeScriptSettings } from "./TypeScriptSettings";
import { TypeScriptUtils } from "./TypeScriptUtils";
import { JavaHashMap } from "./util";
import { replaceLast } from "./validation/ReplaceLast";

const CLIENT_CONFIGURATION_TEMPLATE = "extensionConfiguration.template";
const FILENAME = "extensionConfiguration.ts";

/**
 * Generates the extension configuration interface from the integrations that contribute to it.
 */
export class ExtensionConfigurationGenerator {
  private readonly _model: Model;
  private readonly _settings: TypeScriptSettings;
  private readonly _service: ServiceShape;
  private readonly _symbolProvider: SymbolProvider;
  private readonly _delegator: TypeScriptDelegator;
  private readonly _integrations: TypeScriptIntegration[];

  public constructor(
    model: Model,
    settings: TypeScriptSettings,
    service: ServiceShape,
    symbolProvider: SymbolProvider,
    delegator: TypeScriptDelegator,
    integrations: TypeScriptIntegration[]
  ) {
    this._model = model;
    this._settings = settings;
    this._service = service;
    this._symbolProvider = symbolProvider;
    this._delegator = delegator;
    this._integrations = integrations;
  }

  public generate(): void {
    const interfaces = new JavaHashMap<Dependency>();
    const submodules = new JavaHashMap<string>();
    for (const integration of this._integrations) {
      for (const configurationInterface of integration.getExtensionConfigurationInterfaces(
        this._model,
        this._settings
      )) {
        const [name, dependency] = configurationInterface.name();
        interfaces.set(name, dependency);
        const submodule = configurationInterface.submodule?.();
        if (submodule !== undefined && submodule !== null) {
          submodules.set(name, submodule);
        }
      }
    }
    const clientName = replaceLast(
      replaceLast(this._symbolProvider.toSymbol(this._service).getName(), "Client", ""),
      "client",
      ""
    );
    const clientConfigurationContent = TypeScriptUtils.loadResourceAsString(CLIENT_CONFIGURATION_TEMPLATE)
      .split("${extensionConfigName}")
      .join(clientName + "ExtensionConfiguration")
      .split("${extensionConfigInterfaces}")
      .join([...interfaces.keys()].join(",\n    "));

    this._delegator.useFileWriter([CodegenUtils.SOURCE_FOLDER, FILENAME].join("/"), (writer) => {
      for (const [name, dependency] of interfaces.entries()) {
        writer.addDependency(dependency);
        const submodule = submodules.get(name);
        if (submodule !== undefined && dependency.getPackageName() === "@smithy/core") {
          writer.addTypeImportSubmodule(name, null, dependency, submodule);
        } else {
          writer.addTypeImport(name, null, dependency);
        }
      }
      writer.write(clientConfigurationContent);
    });
  }
}
