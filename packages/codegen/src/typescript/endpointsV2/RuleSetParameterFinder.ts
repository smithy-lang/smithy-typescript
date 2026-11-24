import {
  ClientContextParamsTrait,
  ContextParamTrait,
  EndpointRuleSetTrait,
  type MemberShape,
  type OperationShape,
  OperationContextParamsTrait,
  type ServiceShape,
  type Shape,
  StaticContextParamsTrait,
  TreeSet,
} from "../../model";
import { StringUtils } from "../../codegen-core";
import type { JsonObject } from "../TypeScriptSettings";
import type { TypeScriptWriter } from "../TypeScriptWriter";
import { JavaHashMap } from "../util";
import { ClientConfigKeys } from "./ClientConfigKeys";
import { OmitEndpointParams } from "./OmitEndpointParams";
import { ParameterGenerator } from "./ParameterGenerator";

/**
 * Finds the endpoint parameters of a service from its rule set and context param traits.
 */
export class RuleSetParameterFinder {
  public static readonly URL_PARAMETERS = /\{(\w+)[}#]/g;

  private readonly _service: ServiceShape;
  private readonly _ruleset: EndpointRuleSetTrait;

  public constructor(service: ServiceShape) {
    this._service = service;
    const ruleset = service.getTrait(EndpointRuleSetTrait);
    if (ruleset === undefined) {
      throw new Error("Service does not have EndpointRuleSetTrait.");
    }
    this._ruleset = ruleset;
  }

  public getParametersNode(): JsonObject | undefined {
    return (this._ruleset.getRuleSet() as JsonObject).parameters as JsonObject | undefined;
  }

  public getEffectiveParams(): string[] {
    const ruleSet = this._ruleset.getRuleSet() as JsonObject;
    const effectiveParams = new TreeSet<string>();
    const initialParams = new Set(Object.keys((ruleSet.parameters as JsonObject | undefined) ?? {}));
    const addTemplateParams = (text: string): void => {
      for (const match of text.matchAll(RuleSetParameterFinder.URL_PARAMETERS)) {
        if (initialParams.has(match[1])) {
          effectiveParams.add(match[1]);
        }
      }
    };
    const visitArg = (arg: unknown): void => {
      if (typeof arg === "string") {
        addTemplateParams(arg);
      } else if (typeof arg === "object" && arg !== null && !Array.isArray(arg)) {
        const node = arg as JsonObject;
        if (typeof node.ref === "string" && initialParams.has(node.ref)) {
          effectiveParams.add(node.ref);
        }
        if (Array.isArray(node.argv)) {
          for (const nested of node.argv) {
            if (typeof nested === "object" && nested !== null) {
              visitArg(nested);
            }
          }
        }
      }
    };
    const visitRules = (rules: unknown[]): void => {
      for (const rule of rules as JsonObject[]) {
        for (const condition of (rule.conditions as JsonObject[] | undefined) ?? []) {
          for (const arg of (condition.argv as unknown[] | undefined) ?? []) {
            visitArg(arg);
          }
        }
        if (rule.type === "tree") {
          visitRules((rule.rules as unknown[] | undefined) ?? []);
        } else if (rule.type === "endpoint") {
          const url = (rule.endpoint as JsonObject).url;
          addTemplateParams(typeof url === "string" ? url : RuleSetParameterFinder._expressionToString(url));
        }
      }
    };
    visitRules((ruleSet.rules as unknown[] | undefined) ?? []);
    return [...effectiveParams];
  }

  public getBuiltInParams(): JavaHashMap<string> {
    const map = new JavaHashMap<string>();
    const parameters = this.getParametersNode();
    if (parameters !== undefined) {
      for (const [key, param] of Object.entries(parameters)) {
        const generator = new ParameterGenerator(key, param);
        if (generator.isBuiltIn()) {
          const [name, type] = generator.getNameAndType();
          map.set(name, type);
        }
      }
    }
    return map;
  }

  public getBuiltInParamsWithoutOmitted(): JavaHashMap<string> {
    const builtInParams = this.getBuiltInParams();
    for (const key of Array.from(builtInParams.keys())) {
      if (OmitEndpointParams.isOmitted(key)) {
        builtInParams.delete(key);
      }
    }
    return builtInParams;
  }

  public hasCustomClientContextParams(): boolean {
    const customContextParams = ClientConfigKeys.getCustomContextParams(
      this.getClientContextParams(),
      this.getBuiltInParamsWithoutOmitted()
    );
    return customContextParams.size > 0;
  }

  public writeNestedClientContextParamDefaults(writer: TypeScriptWriter): void {
    const clientContextParams = this.getClientContextParams();
    const builtInParams = this.getBuiltInParamsWithoutOmitted();
    const parameters = this.getParametersNode();
    if (parameters === undefined) {
      return;
    }
    writer.write("");
    writer.writeDocs("@internal");
    const hasDefault = (name: string): boolean => {
      const node = parameters[name] as JsonObject | undefined;
      return node !== undefined && "default" in node;
    };
    writer.openCollapsibleBlock(
      "const clientContextParamDefaults = {",
      "} as const;",
      [...clientContextParams.keys()].some(
        (k) => ClientConfigKeys.isKnownConfigKey(k) && !builtInParams.has(k) && hasDefault(k)
      ),
      () => {
        for (const paramName of clientContextParams.keys()) {
          if (ClientConfigKeys.isKnownConfigKey(paramName) && !builtInParams.has(paramName)) {
            const paramNode = parameters[paramName] as JsonObject | undefined;
            if (paramNode !== undefined && "default" in paramNode) {
              const defaultValue = paramNode.default;
              if (typeof defaultValue === "string") {
                writer.write("$L: $L,", paramName, StringUtils.escapeJavaString(defaultValue, ""));
              } else if (typeof defaultValue === "boolean") {
                writer.write("$L: $L,", paramName, defaultValue);
              }
            }
          }
        }
      }
    );
  }

  public writeConfigResolverNestedClientContextParams(writer: TypeScriptWriter): void {
    const customContextParams = ClientConfigKeys.getCustomContextParams(
      this.getClientContextParams(),
      this.getBuiltInParamsWithoutOmitted()
    );
    const parameters = this.getParametersNode();
    let hasDefaultsForResolve = false;
    if (parameters !== undefined) {
      hasDefaultsForResolve = [...customContextParams.keys()].some((key) => {
        const paramNode = parameters[key] as JsonObject | undefined;
        return paramNode !== undefined && "default" in paramNode;
      });
    }
    if (hasDefaultsForResolve) {
      writer.write("clientContextParams: Object.assign(clientContextParamDefaults, options.clientContextParams),");
    } else {
      writer.write("clientContextParams: options.clientContextParams ?? {},");
    }
  }

  public getClientContextParams(): JavaHashMap<string> {
    const map = new JavaHashMap<string>();
    const trait = this._service.getTrait(ClientContextParamsTrait);
    if (trait !== undefined) {
      for (const [name, definition] of trait.getParameters()) {
        const type = definition.getType();
        if (type === "string" || type === "boolean") {
          map.set(name, type);
        } else if (type === "list") {
          map.set(name, "string[]");
        } else {
          throw new Error(`unexpected type ${type} received as clientContextParam.`);
        }
      }
    }
    return map;
  }

  public getStaticContextParamValues(operation: OperationShape): JavaHashMap<string> {
    const map = new JavaHashMap<string>();
    const trait = operation.getTrait(StaticContextParamsTrait);
    if (trait !== undefined) {
      for (const [name, definition] of trait.getParameters()) {
        const rawValue = definition.getValue();
        let value: string;
        if (typeof rawValue === "string") {
          value = "`" + rawValue + "`";
        } else if (typeof rawValue === "boolean") {
          value = String(rawValue);
        } else if (Array.isArray(rawValue)) {
          value = "[`" + rawValue.map(String).join("`, `") + "`]";
        } else {
          throw new Error(`unexpected type ${typeof rawValue} received as staticContextParam.`);
        }
        map.set(name, value);
      }
    }
    return map;
  }

  public getContextParams(operationInput: Shape): JavaHashMap<string> {
    const map = new JavaHashMap<string>();
    if (operationInput.isStructureShape()) {
      operationInput.getAllMembers().forEach((member: MemberShape, memberName: string) => {
        const trait = member.getTrait(ContextParamTrait);
        if (trait !== undefined) {
          map.set(trait.getName(), memberName);
        }
      });
    }
    return map;
  }

  public getOperationContextParamValues(operation: OperationShape): JavaHashMap<string> {
    const map = new JavaHashMap<string>();
    const trait = operation.getTrait(OperationContextParamsTrait);
    if (trait !== undefined) {
      for (const [name, definition] of trait.getParameters()) {
        const separator = "?.";
        let value = this.getJmesPathExpression(separator, "input", definition.getPath());
        const noOpMap = "map((obj: any) => obj";
        if (value.endsWith(separator + noOpMap)) {
          value = value.substring(0, value.length - noOpMap.length - separator.length);
        }
        const open = [...value].filter((ch) => ch === "(").length;
        const close = [...value].filter((ch) => ch === ")").length;
        value += ")".repeat(open - close);
        map.set(name, value);
      }
    }
    return map;
  }

  public getJmesPathExpression(separator: string, initialValue: string, initialPath: string): string {
    let value = initialValue;
    let path = initialPath;
    while (path.length > 0) {
      if (path.startsWith("[") && !path.startsWith("[*]")) {
        if (value.endsWith("obj")) {
          value = value.substring(0, value.length - 3);
        }
        value += "[";
        path = path.substring(1);
        for (;;) {
          const commaIndex = path.indexOf(",");
          const sepIndex = commaIndex === -1 ? path.indexOf("]") : commaIndex;
          const part = path.substring(0, sepIndex);
          path = path.substring(sepIndex + 1).trim();
          value += this.getJmesPathExpression(separator, "obj", part) + ",";
          if (commaIndex === -1) {
            value = value.substring(0, value.length - 1) + "].filter((i) => i))";
            break;
          }
        }
        if (path.startsWith("[]")) {
          value += ".flat()";
          path = path.substring(2);
        }
        continue;
      }
      const dotIndex = path.indexOf(".");
      const part = dotIndex === -1 ? path : path.substring(0, dotIndex);
      path = dotIndex === -1 ? "" : path.substring(dotIndex + 1);
      value = this._getJmesPathExpressionSection(separator, value, part);
    }
    return value;
  }

  private static _expressionToString(expression: unknown): string {
    if (typeof expression === "object" && expression !== null && !Array.isArray(expression)) {
      const node = expression as JsonObject;
      if (typeof node.ref === "string") {
        return `{${node.ref}}`;
      }
    }
    return JSON.stringify(expression);
  }

  private _getJmesPathExpressionSection(separator: string, initialValue: string, part: string): string {
    let value = initialValue;
    if (value.endsWith(")")) {
      value += ".map((obj: any) => obj";
    }
    if (part.startsWith("keys(")) {
      const object = part.substring(5, part.length - 1);
      return "Object.keys(" + value + separator + object + " ?? {})";
    }
    if (part === "*" || part === "[*]") {
      return "Object.values(" + value + " ?? {})";
    }
    if (part.endsWith("[*]")) {
      const key = part.substring(0, part.length - 3);
      return value + separator + key + separator + "map((obj: any) => obj";
    }
    if (part.endsWith("[]")) {
      const key = part.substring(0, part.length - 2);
      if (key.endsWith("[*]")) {
        return value + separator + key.substring(0, key.length - 3) + ".flat()";
      }
      return value + separator + key + ").flat()";
    }
    return value + separator + part;
  }
}
