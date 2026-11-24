import type { JsonObject } from "../TypeScriptSettings";

/**
 * Renders a single endpoint rule set parameter as TypeScript.
 */
export class ParameterGenerator {
  private readonly _parameterName: string;
  private readonly _param: JsonObject;
  private readonly _isInputKey: boolean;
  private _required = false;
  private _tsParamType = "string";

  public constructor(key: string, param: unknown, isInputKey = false) {
    this._parameterName = key;
    this._isInputKey = isInputKey;
    if (typeof param !== "object" || param === null || Array.isArray(param)) {
      throw new Error("param node is not object node.");
    }
    this._param = param as JsonObject;
    if (typeof this._param.required === "boolean") {
      this._required = this._param.required;
    }
    switch (this._param.type) {
      case "String":
      case "string":
        this._tsParamType = "string";
        break;
      case "Boolean":
      case "boolean":
        this._tsParamType = "boolean";
        break;
      case "stringArray":
        this._tsParamType = "string[]";
        break;
      default:
        break;
    }
  }

  public isBuiltIn(): boolean {
    return "builtIn" in this._param;
  }

  public hasDefault(): boolean {
    return "default" in this._param;
  }

  public defaultAsCodeString(): string {
    if (!this.hasDefault()) {
      return "";
    }
    let buffer = `${this._parameterName}: options.${this._parameterName} ?? `;
    const type = this._param.type;
    switch (type) {
      case "String":
      case "string":
        buffer += `"${this._param.default}"`;
        break;
      case "Boolean":
      case "boolean":
        buffer += this._param.default === true ? "true" : "false";
        break;
      case "stringArray":
        buffer += "[`" + (this._param.default as string[]).join("`, `") + "`]";
        break;
      default:
        throw new Error(`Unhandled endpoint param type: ${type}`);
    }
    return buffer + ",";
  }

  public getNameAndType(): [string, string] {
    return [this._parameterName, this._tsParamType];
  }

  public toCodeString(isClientContextParam: boolean): string {
    let buffer = this._parameterName;
    const optional = !this._required || this.hasDefault() || isClientContextParam;
    if (optional) {
      buffer += "?";
    }
    buffer += ": ";
    if (this._parameterName === "endpoint" && this._isInputKey) {
      buffer += "string | Provider<string> | Endpoint | Provider<Endpoint> | EndpointV2 | Provider<EndpointV2>;";
    } else if (optional) {
      buffer += isClientContextParam
        ? `${this._tsParamType} | undefined | Provider<${this._tsParamType} | undefined>;`
        : `${this._tsParamType} | undefined;`;
    } else {
      buffer += `${this._tsParamType};`;
    }
    return buffer;
  }
}
