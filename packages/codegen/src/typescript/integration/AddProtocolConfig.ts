import type { SymbolProvider } from "../../codegen-core";
import type { Model } from "../../model";
import { LanguageTarget } from "../LanguageTarget";
import { SchemaGenerationAllowlist } from "../schema/SchemaGenerationAllowlist";
import { TypeScriptDependency } from "../TypeScriptDependency";
import type { TypeScriptSettings } from "../TypeScriptSettings";
import type { TypeScriptWriter } from "../TypeScriptWriter";
import { TypeScriptIntegration } from "./TypeScriptIntegration";

const RPCV2_CBOR = "smithy.protocols#rpcv2Cbor";
const RPCV2_JSON = "smithy.protocols#rpcv2Json";

/**
 * Adds the protocol and protocolSettings runtime config for schema-based clients.
 */
export class AddProtocolConfig extends TypeScriptIntegration {
  public getRuntimeConfigWriters(
    settings: TypeScriptSettings,
    _model: Model,
    _symbolProvider: SymbolProvider,
    target: LanguageTarget
  ): Map<string, (writer: TypeScriptWriter) => void> {
    if (!SchemaGenerationAllowlist.allows(settings.getService(), settings)) {
      return new Map();
    }
    const namespace = settings.getService().getNamespace();
    const protocolSettingsWriter = (writer: TypeScriptWriter): void => {
      writer.addRelativeImport("errorTypeRegistries", null, "./src/schemas/schemas_0");
      writer.write("{\n  defaultNamespace: $S,\n  errorTypeRegistries,\n}", namespace);
    };
    if (target !== LanguageTarget.SHARED) {
      return new Map();
    }
    const protocol = settings.getProtocol()?.toString();
    if (protocol === RPCV2_CBOR) {
      return new Map([
        [
          "protocol",
          (writer) => {
            writer.addImportSubmodule("SmithyRpcV2CborProtocol", null, TypeScriptDependency.SMITHY_CORE, "/cbor");
            writer.write("SmithyRpcV2CborProtocol");
          },
        ],
        ["protocolSettings", protocolSettingsWriter],
      ]);
    }
    if (protocol === RPCV2_JSON) {
      return new Map([
        [
          "protocol",
          (writer) => {
            writer.addImportSubmodule("SmithyRpcV2JsonProtocol", null, TypeScriptDependency.SMITHY_CORE, "/protocols");
            writer.write("SmithyRpcV2JsonProtocol");
          },
        ],
        ["protocolSettings", protocolSettingsWriter],
      ]);
    }
    return new Map();
  }
}
