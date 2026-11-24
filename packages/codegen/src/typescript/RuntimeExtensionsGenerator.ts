import type { SymbolProvider } from "../codegen-core";
import type { Model, ServiceShape } from "../model";
import { CodegenUtils } from "./CodegenUtils";
import type { TypeScriptIntegration } from "./integration/TypeScriptIntegration";
import type { TypeScriptDelegator } from "./TypeScriptDelegator";
import type { TypeScriptSettings } from "./TypeScriptSettings";
import { TypeScriptUtils } from "./TypeScriptUtils";
import { replaceLast } from "./validation/ReplaceLast";

const TEMPLATE_1 = "resolveRuntimeExtensions1.template";
const TEMPLATE_2 = "resolveRuntimeExtensions2.template";
const FILENAME = "runtimeExtensions.ts";

const sanitizeTemplate = (template: string): string => template.split("$").join("$$");

/**
 * Generates the runtime extension resolver.
 */
export class RuntimeExtensionsGenerator {
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
    const clientName = replaceLast(
      replaceLast(this._symbolProvider.toSymbol(this._service).getName(), "Client", ""),
      "client",
      ""
    );
    const template1Contents = sanitizeTemplate(
      TypeScriptUtils.loadResourceAsString(TEMPLATE_1)
        .split("${extensionConfigName}")
        .join(clientName + "ExtensionConfiguration")
    )
      .split("$${getPartialExtensionConfigurations}")
      .join("${L@getPartialExtensionConfigurations}");
    const template2Contents = sanitizeTemplate(TypeScriptUtils.loadResourceAsString(TEMPLATE_2))
      .split("$${resolvePartialRuntimeConfigs}")
      .join("${L@resolvePartialRuntimeConfigs}");

    this._delegator.useFileWriter([CodegenUtils.SOURCE_FOLDER, FILENAME].join("/"), (writer) => {
      for (const integration of this._integrations) {
        for (const configurationInterface of integration.getExtensionConfigurationInterfaces(
          this._model,
          this._settings
        )) {
          const [fnName, fnDependency] = configurationInterface.getExtensionConfigurationFn();
          const [resolveName, resolveDependency] = configurationInterface.resolveRuntimeConfigFn();
          writer.addDependency(fnDependency);
          writer.addDependency(resolveDependency);
          const submodule = configurationInterface.submodule?.();
          if (submodule !== undefined && submodule !== null) {
            writer.addImportSubmodule(fnName, null, fnDependency, submodule);
            writer.addImportSubmodule(resolveName, null, resolveDependency, submodule);
          } else {
            writer.addImport(fnName, null, fnDependency);
            writer.addImport(resolveName, null, resolveDependency);
          }
        }
      }
      writer.indent().onSection("getPartialExtensionConfigurations", () => {
        for (const integration of this._integrations) {
          for (const configurationInterface of integration.getExtensionConfigurationInterfaces(
            this._model,
            this._settings
          )) {
            writer.indent(2).write("$L(runtimeConfig),", configurationInterface.getExtensionConfigurationFn()[0]);
            writer.dedent(2);
          }
        }
        writer.unwrite(",\n").write("");
      });
      writer.dedent().write(template1Contents, "");
      writer.indent().onSection("resolvePartialRuntimeConfigs", () => {
        for (const integration of this._integrations) {
          for (const configurationInterface of integration.getExtensionConfigurationInterfaces(
            this._model,
            this._settings
          )) {
            writer.indent(2).write("$L(extensionConfiguration),", configurationInterface.resolveRuntimeConfigFn()[0]);
            writer.dedent(2);
          }
        }
        writer.unwrite(",\n").write("");
      });
      writer.dedent().write(template2Contents, "");
    });
  }
}
