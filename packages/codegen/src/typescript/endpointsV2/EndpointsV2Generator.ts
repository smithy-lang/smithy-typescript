import type { SymbolDependency } from "../../codegen-core";
import type { Model, ServiceShape } from "../../model";
import { CodegenUtils } from "../CodegenUtils";
import type { Dependency } from "../Dependency";
import { SmithyCoreSubmodules } from "../SmithyCoreSubmodules";
import type { TypeScriptDelegator } from "../TypeScriptDelegator";
import { TypeScriptDependency } from "../TypeScriptDependency";
import type { JsonObject, TypeScriptSettings } from "../TypeScriptSettings";
import type { JsonValue } from "../util/JsonValue";
import { EndpointRule, ErrorRule, NoMatchRule, type Rule, TreeRule } from "../../rulesengine/language";
import type { EndpointBddTrait } from "../../rulesengine/traits/EndpointBddTrait";
import { JavaHashMap, PatternDetectionCompression } from "../util";
import { ConvertBdd } from "./ConvertBdd";
import { ClientConfigKeys } from "./ClientConfigKeys";
import { EndpointsParamNameMap } from "./EndpointsParamNameMap";
import { RuleSetParameterFinder } from "./RuleSetParameterFinder";
import { RuleSetParametersVisitor } from "./RuleSetParametersVisitor";

const ENDPOINT_PARAMETERS_FILE = "EndpointParameters.ts";
const ENDPOINT_RESOLVER_FILE = "endpointResolver.ts";
const ENDPOINT_BDD_FILE = "bdd.ts";

const ENDPOINT_FOLDER = "endpoint";
const ENDPOINT_PARAMETERS_MODULE_NAME = "EndpointParameters";
const ENDPOINT_RESOLVER_MODULE_NAME = "endpointResolver";

const moduleDependency = (packageName: string): Dependency => ({
  getPackageName: () => packageName,
  getDependencies: (): SymbolDependency[] => [],
});

/**
 * Generates the endpoint parameters, resolver and rule set modules.
 */
export class EndpointsV2Generator {
  public static readonly ENDPOINT_PARAMETERS_MODULE = [
    ".",
    CodegenUtils.SOURCE_FOLDER,
    ENDPOINT_FOLDER,
    ENDPOINT_PARAMETERS_MODULE_NAME,
  ].join("/");
  public static readonly ENDPOINT_PARAMETERS_DEPENDENCY: Dependency = moduleDependency(
    EndpointsV2Generator.ENDPOINT_PARAMETERS_MODULE
  );
  public static readonly ENDPOINT_RESOLVER_MODULE = [
    ".",
    CodegenUtils.SOURCE_FOLDER,
    ENDPOINT_FOLDER,
    ENDPOINT_RESOLVER_MODULE_NAME,
  ].join("/");
  public static readonly ENDPOINT_RESOLVER_DEPENDENCY: Dependency = moduleDependency(
    EndpointsV2Generator.ENDPOINT_RESOLVER_MODULE
  );

  private readonly _delegator: TypeScriptDelegator;
  private readonly _service: ServiceShape;
  private readonly _settings: TypeScriptSettings;
  private readonly _ruleSetParameterFinder: RuleSetParameterFinder;
  private readonly _endpointBddTrait: EndpointBddTrait;

  public constructor(delegator: TypeScriptDelegator, settings: TypeScriptSettings, model: Model) {
    this._delegator = delegator;
    this._service = settings.getService(model);
    this._settings = settings;
    this._endpointBddTrait = ConvertBdd.forService(model, settings);
    this._ruleSetParameterFinder = new RuleSetParameterFinder(this._service);
  }

  public run(): void {
    this._generateEndpointParameters();
    this._generateEndpointResolver();
    if (this._settings.generateEndpointBdd()) {
      this._generateEndpointBdd();
    } else {
      throw new Error("Generating the endpoint rule set module is not ported");
    }
  }

  private _generateEndpointBdd(): void {
    const trait = this._endpointBddTrait;
    this._delegator.useFileWriter(
      [CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER, ENDPOINT_BDD_FILE].join("/"),
      (writer) => {
        const conditionsAndResults = {
          conditions: trait.getConditions().map((condition) => {
            const node = condition.toNode() as { fn: JsonValue; argv: JsonValue; assign?: JsonValue };
            return node.assign === undefined ? [node.fn, node.argv] : [node.fn, node.argv, node.assign];
          }),
          results: trait.getResults().map((rule) => serializeResult(rule)),
        };
        writer.write(new PatternDetectionCompression(conditionsAndResults).compress());
        const bdd = trait.getBdd();
        writer
          .write(
            `const root = $L;
const r = 100_000_000;
const nodes = new Int32Array([`,
            bdd.getRootRef()
          )
          .indent();
        bdd.getNodes((variable, high, low) => {
          writer.write("$L, $L, $L,", shortestJsLiteral(variable), shortestJsLiteral(high), shortestJsLiteral(low));
        });
        writer.dedent().write("]);");
        writer.addImportSubmodule(
          "BinaryDecisionDiagram",
          null,
          TypeScriptDependency.SMITHY_CORE,
          SmithyCoreSubmodules.ENDPOINTS
        );
        writer.write(`export const bdd = BinaryDecisionDiagram.from(
  nodes, root, _data.conditions, _data.results
);`);
      }
    );
  }

  private _generateEndpointParameters(): void {
    const finder = this._ruleSetParameterFinder;
    const settings = this._settings;
    this._delegator.useFileWriter(
      [CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER, ENDPOINT_PARAMETERS_FILE].join("/"),
      (writer) => {
        writer.addTypeImport("EndpointParameters", "__EndpointParameters", TypeScriptDependency.SMITHY_TYPES);
        writer.addTypeImport("Provider", null, TypeScriptDependency.SMITHY_TYPES);
        const clientContextParams = finder.getClientContextParams();
        const builtInParams = finder.getBuiltInParamsWithoutOmitted();
        const customContextParams = ClientConfigKeys.getCustomContextParams(clientContextParams, builtInParams);
        const parameters = finder.getParametersNode();

        writer.writeDocs("@public");
        writer.openBlock("export interface ClientInputEndpointParameters {", "}", () => {
          const excludingBuiltIns = new JavaHashMap<string>();
          for (const [key, value] of clientContextParams.entries()) {
            excludingBuiltIns.set(key, value);
          }
          for (const key of builtInParams.keys()) {
            excludingBuiltIns.delete(key);
          }
          if (excludingBuiltIns.size > 0) {
            writer.write("clientContextParams?: {");
            writer.indent();
            if (parameters !== undefined) {
              new RuleSetParametersVisitor(writer, {
                clientContextParams: excludingBuiltIns,
                useLocalNames: true,
              }).visit(parameters);
            }
            writer.dedent();
            writer.write("};");
          }
          const directParams = new JavaHashMap<string>();
          for (const [key, value] of builtInParams.entries()) {
            directParams.set(key, value);
          }
          for (const [paramName, value] of customContextParams.entries()) {
            const localName = EndpointsParamNameMap.getLocalName(paramName);
            if (!ClientConfigKeys.isKnownConfigKey(paramName) && !ClientConfigKeys.isKnownConfigKey(localName)) {
              directParams.set(paramName, value);
            }
          }
          if (parameters !== undefined) {
            new RuleSetParametersVisitor(writer, { clientContextParams: directParams, useLocalNames: true }).visit(
              parameters
            );
          }
        });
        writer.write("");
        writer.writeDocs("@public");
        writer.write(
          'export type ClientResolvedEndpointParameters = Omit<ClientInputEndpointParameters, "endpoint"> & {\n  defaultSigningName: string;\n};'
        );
        if (finder.hasCustomClientContextParams()) {
          finder.writeNestedClientContextParamDefaults(writer);
        }
        writer.write("");
        writer.writeDocs("@internal");
        writer.openBlock(
          "export const resolveClientEndpointParameters = <T>(\n  options: T & ClientInputEndpointParameters\n): T & ClientResolvedEndpointParameters => {",
          "};",
          () => {
            writer.openBlock("return Object.assign(options, {", "});", () => {
              const clientLevelParams = new Set<string>([
                ...finder.getBuiltInParams().keys(),
                ...finder.getClientContextParams().keys(),
              ]);
              if (parameters !== undefined) {
                new RuleSetParametersVisitor(writer, {
                  writeDefaults: true,
                  useLocalNames: true,
                  clientLevelParams,
                }).visit(parameters);
              }
              writer.write('defaultSigningName: "$L",', settings.getDefaultSigningName());
              if (finder.hasCustomClientContextParams()) {
                finder.writeConfigResolverNestedClientContextParams(writer);
              }
            });
          }
        );
        writer.write("");
        writer.addTypeImport("EndpointParameterInstructions", null, TypeScriptDependency.SMITHY_TYPES);
        writer.writeDocs("@internal");
        writer.openBlock("export const commonParams = {", "} as const satisfies EndpointParameterInstructions;", () => {
          const paramNames = new Set<string>();
          for (const name of finder.getClientContextParams().keys()) {
            if (!paramNames.has(name)) {
              writer.write(
                '$L: { type: "clientContextParams", name: "$L" },',
                name,
                EndpointsParamNameMap.getLocalName(name)
              );
            }
            paramNames.add(name);
          }
          for (const name of finder.getBuiltInParams().keys()) {
            if (!paramNames.has(name)) {
              writer.write(
                '$L: { type: "builtInParams", name: "$L" },',
                name,
                EndpointsParamNameMap.getLocalName(name)
              );
            }
            paramNames.add(name);
          }
        });
        writer.write("");
        writer.writeDocs("@internal");
        writer.openBlock("export interface EndpointParameters extends __EndpointParameters {", "}", () => {
          if (parameters !== undefined) {
            new RuleSetParametersVisitor(writer).visit(parameters);
          }
        });
      }
    );
  }

  private _generateEndpointResolver(): void {
    const finder = this._ruleSetParameterFinder;
    const settings = this._settings;
    this._delegator.useFileWriter(
      [CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER, ENDPOINT_RESOLVER_FILE].join("/"),
      (writer) => {
        writer.addTypeImport("EndpointV2", null, TypeScriptDependency.SMITHY_TYPES);
        writer.addTypeImport("Logger", null, TypeScriptDependency.SMITHY_TYPES);
        writer.addDependency(TypeScriptDependency.SMITHY_CORE);
        writer.addTypeImportSubmodule(
          "EndpointParams",
          null,
          TypeScriptDependency.SMITHY_CORE,
          SmithyCoreSubmodules.ENDPOINTS
        );
        if (settings.generateEndpointBdd()) {
          writer.addImportSubmodule(
            "decideEndpoint",
            null,
            TypeScriptDependency.SMITHY_CORE,
            SmithyCoreSubmodules.ENDPOINTS
          );
          writer.addRelativeImport("bdd", null, "./" + [CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER, "bdd"].join("/"));
        } else {
          writer.addImportSubmodule(
            "resolveEndpoint",
            null,
            TypeScriptDependency.SMITHY_CORE,
            SmithyCoreSubmodules.ENDPOINTS
          );
          writer.addRelativeImport(
            "ruleSet",
            null,
            "./" + [CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER, "ruleset"].join("/")
          );
        }
        writer.addRelativeTypeImport(
          "EndpointParameters",
          null,
          "./" + [CodegenUtils.SOURCE_FOLDER, ENDPOINT_FOLDER, ENDPOINT_PARAMETERS_FILE.replace(".ts", "")].join("/")
        );
        writer.addImportSubmodule(
          "EndpointCache",
          null,
          TypeScriptDependency.SMITHY_CORE,
          SmithyCoreSubmodules.ENDPOINTS
        );

        const effectiveParams = finder.getEffectiveParams();
        if (effectiveParams.length >= 8) {
          writer.openBlock("const cache = new EndpointCache({", "});", () => {
            writer.write("size: 50,");
            writer.openBlock("params: [", "],", () => {
              for (const param of effectiveParams) {
                writer.write("$S,", param);
              }
            });
          });
          writer.write("");
        } else {
          writer.write(
            "const cache = new EndpointCache({\n  size: 50,\n  params: [$L],\n});\n",
            '"' + effectiveParams.join('", "') + '"'
          );
        }

        const clientLevelParams = new Set<string>([
          ...finder.getBuiltInParams().keys(),
          ...finder.getClientContextParams().keys(),
        ]);
        const operationDefaults = new JavaHashMap<string>();
        const parameters = finder.getParametersNode();
        if (parameters !== undefined) {
          for (const [paramName, value] of Object.entries(parameters)) {
            if (clientLevelParams.has(paramName)) {
              continue;
            }
            const paramNode = value as JsonObject;
            if ("default" in paramNode) {
              const type = String(paramNode.type).toLowerCase();
              let defaultStr: string | undefined;
              if (type === "string") {
                defaultStr = `"${paramNode.default}"`;
              } else if (type === "boolean") {
                defaultStr = String(paramNode.default);
              }
              if (defaultStr !== undefined) {
                operationDefaults.set(paramName, defaultStr);
              }
            }
          }
        }
        const resolveFn = settings.generateEndpointBdd() ? "decideEndpoint(bdd" : "resolveEndpoint(ruleSet";
        writer.writeDocs("@internal");
        if (operationDefaults.size > 0) {
          writer.write(
            "export const defaultEndpointResolver = (\n  endpointParams: EndpointParameters,\n  context: { logger?: Logger } = {}\n): EndpointV2 => {\n  const params = { ...endpointParams } as EndpointParams;"
          );
          writer.indent();
          for (const [paramName, defaultStr] of operationDefaults.entries()) {
            writer.write("params.$L ??= $L;", paramName, defaultStr);
          }
          writer.dedent();
          writer.write(
            "  return cache.get(params, () =>\n    $L, {\n      endpointParams: params,\n      logger: context.logger,\n    })\n  );\n};\n",
            resolveFn
          );
        } else {
          writer.write(
            "export const defaultEndpointResolver = (\n  endpointParams: EndpointParameters,\n  context: { logger?: Logger } = {}\n): EndpointV2 => {\n  return cache.get(endpointParams as EndpointParams, () =>\n    $L, {\n      endpointParams: endpointParams as EndpointParams,\n      logger: context.logger,\n    })\n  );\n};\n",
            resolveFn
          );
        }
      }
    );
  }
}

const serializeResult = (rule: Rule): JsonValue => {
  if (rule.getConditions().length > 0) {
    throw new Error("Endpoint rules for BDD must not contain conditions.");
  }
  if (rule instanceof EndpointRule) {
    const endpoint = rule.getEndpoint().toNode() as {
      url: JsonValue;
      properties: { [key: string]: JsonValue };
      headers: { [key: string]: JsonValue };
    };
    return Object.keys(endpoint.headers).length === 0
      ? [endpoint.url, endpoint.properties]
      : [endpoint.url, endpoint.properties, endpoint.headers];
  } else if (rule instanceof ErrorRule) {
    return [-1, rule.getError().toNode()];
  } else if (rule instanceof NoMatchRule) {
    return [-1];
  } else if (rule instanceof TreeRule) {
    throw new Error("BDD should not have TreeRule objects.");
  }
  throw new Error("Unrecognized rule type: " + rule.constructor.name);
};

const shortestJsLiteral = (value: number): string => {
  const decimal = String(value);
  const unsigned = value >>> 0;
  const hex = "0x" + unsigned.toString(16).toUpperCase();
  const octal = "0o" + unsigned.toString(8);
  const binary = "0b" + unsigned.toString(2);
  let shortest = decimal;
  for (const candidate of [hex, octal, binary]) {
    if (candidate.length < shortest.length) {
      shortest = candidate;
    }
  }
  if (shortest === decimal && value >= 100000000) {
    return "r + " + (value - 100000000);
  }
  return shortest;
};
