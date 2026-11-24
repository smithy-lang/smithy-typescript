import type { SymbolProvider } from "../../codegen-core";
import type { Model } from "../../model";
import { SmithyCoreSubmodules } from "../SmithyCoreSubmodules";
import { TypeScriptDependency } from "../TypeScriptDependency";
import type { TypeScriptSettings } from "../TypeScriptSettings";
import type { TypeScriptWriter } from "../TypeScriptWriter";
import { TypeScriptIntegration } from "./TypeScriptIntegration";

/**
 * Adds the defaultsMode client config field.
 */
export class AddDefaultsModeDependency extends TypeScriptIntegration {
  public addConfigInterfaceFields(
    _settings: TypeScriptSettings,
    _model: Model,
    _symbolProvider: SymbolProvider,
    writer: TypeScriptWriter
  ): void {
    writer.addDependency(TypeScriptDependency.SMITHY_CORE);
    writer.addTypeImportSubmodule(
      "DefaultsMode",
      "__DefaultsMode",
      TypeScriptDependency.SMITHY_CORE,
      SmithyCoreSubmodules.CLIENT
    );
    writer.addTypeImport("Provider", "__Provider", TypeScriptDependency.SMITHY_TYPES);
    writer.writeDocs(
      "The {@link @smithy/smithy-client#DefaultsMode} that will be used to determine how certain default configuration options are resolved in the SDK."
    );
    writer.write("defaultsMode?: __DefaultsMode | __Provider<__DefaultsMode>;");
  }
}
