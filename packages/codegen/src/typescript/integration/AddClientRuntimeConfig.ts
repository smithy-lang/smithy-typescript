import type { SymbolProvider } from "../../codegen-core";
import type { Model } from "../../model";
import { DefaultExtensionConfigurationInterface } from "../extensions/DefaultExtensionConfigurationInterface";
import type { ExtensionConfigurationInterface } from "../extensions/ExtensionConfigurationInterface";
import { HttpHandlerExtensionConfigurationInterface } from "../extensions/HttpHandlerExtensionConfigurationInterface";
import { LanguageTarget } from "../LanguageTarget";
import { SmithyCoreSubmodules } from "../SmithyCoreSubmodules";
import { TypeScriptDependency } from "../TypeScriptDependency";
import type { TypeScriptSettings } from "../TypeScriptSettings";
import type { TypeScriptWriter } from "../TypeScriptWriter";
import { TypeScriptIntegration } from "./TypeScriptIntegration";

const loadNodeConfigImport = (writer: TypeScriptWriter): void => {
  writer.addDependency(TypeScriptDependency.SMITHY_CORE);
  writer.addImportSubmodule(
    "loadConfig",
    "loadNodeConfig",
    TypeScriptDependency.SMITHY_CORE,
    SmithyCoreSubmodules.CONFIG
  );
};

const retryImport = (writer: TypeScriptWriter, name: string): void => {
  writer.addImportSubmodule(name, null, TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.RETRY);
};

/**
 * Adds retry, logger and extension fields to the client config.
 */
export class AddClientRuntimeConfig extends TypeScriptIntegration {
  public addConfigInterfaceFields(
    _settings: TypeScriptSettings,
    _model: Model,
    _symbolProvider: SymbolProvider,
    writer: TypeScriptWriter
  ): void {
    writer.addTypeImport("Provider", "__Provider", TypeScriptDependency.SMITHY_TYPES);
    writer.addTypeImport("Logger", "__Logger", TypeScriptDependency.SMITHY_TYPES);
    writer
      .writeDocs("Value for how many times a request will be made at most in case of retry.")
      .write("maxAttempts?: number | __Provider<number>;\n");
    writer
      .writeDocs(
        'Specifies which retry algorithm to use.\nAccepted values are "standard" and "adaptive".\n@see https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html\n'
      )
      .write("retryMode?: string | __Provider<string>;\n");
    writer.writeDocs("Optional logger for logging debug/info/warn/error.").write("logger?: __Logger;\n");
    writer.addRelativeTypeImport("RuntimeExtension", null, "./src/runtimeExtensions");
    writer.writeDocs("Optional extensions").write("extensions?: RuntimeExtension[];\n");
  }

  public getRuntimeConfigWriters(
    _settings: TypeScriptSettings,
    _model: Model,
    _symbolProvider: SymbolProvider,
    target: LanguageTarget
  ): Map<string, (writer: TypeScriptWriter) => void> {
    switch (target) {
      case LanguageTarget.SHARED:
        return new Map([
          [
            "logger",
            (writer) => {
              writer.addImportSubmodule(
                "NoOpLogger",
                null,
                TypeScriptDependency.SMITHY_CORE,
                SmithyCoreSubmodules.CLIENT
              );
              writer.write("new NoOpLogger()");
            },
          ],
        ]);
      case LanguageTarget.BROWSER:
        return new Map([
          [
            "maxAttempts",
            (writer) => {
              writer.addDependency(TypeScriptDependency.SMITHY_CORE);
              retryImport(writer, "DEFAULT_MAX_ATTEMPTS");
              writer.write("DEFAULT_MAX_ATTEMPTS");
            },
          ],
          [
            "retryMode",
            (writer) => {
              writer.addDependency(TypeScriptDependency.SMITHY_CORE);
              retryImport(writer, "DEFAULT_RETRY_MODE");
              writer.write("(async () => (await defaultConfigProvider()).retryMode || DEFAULT_RETRY_MODE)");
            },
          ],
        ]);
      case LanguageTarget.NODE:
        return new Map([
          [
            "maxAttempts",
            (writer) => {
              loadNodeConfigImport(writer);
              retryImport(writer, "NODE_MAX_ATTEMPT_CONFIG_OPTIONS");
              writer.write("loadNodeConfig(NODE_MAX_ATTEMPT_CONFIG_OPTIONS, config)");
            },
          ],
          [
            "retryMode",
            (writer) => {
              loadNodeConfigImport(writer);
              writer.addDependency(TypeScriptDependency.SMITHY_CORE);
              retryImport(writer, "NODE_RETRY_MODE_CONFIG_OPTIONS");
              retryImport(writer, "DEFAULT_RETRY_MODE");
              writer.indent();
              writer.writeInline(
                "loadNodeConfig(\n  {\n    ...NODE_RETRY_MODE_CONFIG_OPTIONS,\n    default: async () => (await defaultConfigProvider()).retryMode || DEFAULT_RETRY_MODE,\n  },\n  config\n)"
              );
              writer.dedent();
            },
          ],
        ]);
      default:
        return new Map();
    }
  }

  public getExtensionConfigurationInterfaces(
    _model: Model,
    _settings: TypeScriptSettings
  ): ExtensionConfigurationInterface[] {
    return [new DefaultExtensionConfigurationInterface(), new HttpHandlerExtensionConfigurationInterface()];
  }
}
