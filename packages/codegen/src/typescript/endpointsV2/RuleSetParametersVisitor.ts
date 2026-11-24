import { TypeScriptDependency } from "../TypeScriptDependency";
import type { JsonObject } from "../TypeScriptSettings";
import type { TypeScriptWriter } from "../TypeScriptWriter";
import { ClientConfigKeys } from "./ClientConfigKeys";
import { EndpointsParamNameMap } from "./EndpointsParamNameMap";
import { ParameterGenerator } from "./ParameterGenerator";
import type { JavaHashMap } from "../util";

interface RuleSetParametersVisitorOptions {
  clientContextParams?: JavaHashMap<string>;
  useLocalNames?: boolean;
  writeDefaults?: boolean;
  clientLevelParams?: Set<string>;
}

/**
 * Writes rule set parameters as interface members or default assignments.
 */
export class RuleSetParametersVisitor {
  private readonly _writer: TypeScriptWriter;
  private readonly _options: RuleSetParametersVisitorOptions;

  public constructor(writer: TypeScriptWriter, options: RuleSetParametersVisitorOptions = {}) {
    this._writer = writer;
    this._options = options;
  }

  public visit(parameters: JsonObject): void {
    const writer = this._writer;
    const clientContextParams = this._options.clientContextParams;
    const useLocalNames = this._options.useLocalNames ?? false;
    for (const [key, param] of Object.entries(parameters)) {
      const localKey = useLocalNames ? EndpointsParamNameMap.getLocalName(key) : key;
      const parameterGenerator = new ParameterGenerator(localKey, param, useLocalNames);
      if (localKey === "endpoint") {
        writer.addTypeImport("Endpoint", null, TypeScriptDependency.SMITHY_TYPES);
        writer.addTypeImport("EndpointV2", null, TypeScriptDependency.SMITHY_TYPES);
        writer.addTypeImport("Provider", null, TypeScriptDependency.SMITHY_TYPES);
      }
      if (this._options.writeDefaults) {
        if (
          parameterGenerator.hasDefault() &&
          !ClientConfigKeys.isKnownConfigKey(key) &&
          (this._options.clientLevelParams === undefined || this._options.clientLevelParams.has(key))
        ) {
          writer.write(parameterGenerator.defaultAsCodeString());
        }
      } else if (clientContextParams === undefined || clientContextParams.size === 0 || clientContextParams.has(key)) {
        const isClientContextParams = clientContextParams !== undefined && clientContextParams.size > 0;
        writer.write(parameterGenerator.toCodeString(isClientContextParams));
      }
    }
  }
}
