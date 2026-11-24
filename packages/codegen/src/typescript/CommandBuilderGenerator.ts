import type { Symbol, SymbolProvider, SymbolReference } from "../codegen-core";
import { type Model, type OperationShape, type ServiceShape, TopDownIndex, TreeMap } from "../model";
import { CodegenUtils } from "./CodegenUtils";
import { RuleSetParameterFinder } from "./endpointsV2/RuleSetParameterFinder";
import type { RuntimeClientPlugin } from "./integration/RuntimeClientPlugin";
import { ServiceBareBonesClientGenerator } from "./ServiceBareBonesClientGenerator";
import { SmithyCoreSubmodules } from "./SmithyCoreSubmodules";
import type { TypeScriptDelegator } from "./TypeScriptDelegator";
import { TypeScriptDependency } from "./TypeScriptDependency";
import type { TypeScriptSettings } from "./TypeScriptSettings";
import type { TypeScriptWriter } from "./TypeScriptWriter";

const COMMAND_BUILDER_FILENAME = "commandBuilder.ts";

const isSymbol = (value: unknown): value is Symbol =>
  typeof value === "object" && value !== null && "getNamespace" in value && "getName" in value;

/**
 * Generates commandBuilder.ts with deduplicated endpoint params and middleware.
 */
export class CommandBuilderGenerator {
  private readonly _settings: TypeScriptSettings;
  private readonly _model: Model;
  private readonly _service: ServiceShape;
  private readonly _symbolProvider: SymbolProvider;
  private readonly _runtimePlugins: RuntimeClientPlugin[];
  private readonly _uniqueEndpointParams = new Map<string, string>();
  private readonly _uniqueMiddlewares = new Map<string, string>();
  private readonly _operationEndpointParamVar = new Map<string, string>();
  private readonly _operationMiddlewareVar = new Map<string, string>();
  private _epCounter = 0;
  private _mwCounter = 0;

  public constructor(
    settings: TypeScriptSettings,
    model: Model,
    symbolProvider: SymbolProvider,
    runtimePlugins: RuntimeClientPlugin[]
  ) {
    this._settings = settings;
    this._model = model;
    this._service = settings.getService(model);
    this._symbolProvider = symbolProvider;
    this._runtimePlugins = runtimePlugins;
  }

  public collectOperations(): void {
    const byName = new TreeMap<string, OperationShape>();
    for (const operation of TopDownIndex.of(this._model).getContainedOperations(this._service)) {
      byName.set(this._symbolProvider.toSymbol(operation).getName(), operation);
    }
    const operations = [...byName.values()];
    const parameterFinder = new RuleSetParameterFinder(this._service);
    for (const operation of operations) {
      const operationName = operation.toShapeId().getName();
      const epCode = this._buildEndpointParamsCode(parameterFinder, operation);
      let epVar = this._uniqueEndpointParams.get(epCode);
      if (epVar === undefined) {
        epVar = "_ep" + this._epCounter++;
        this._uniqueEndpointParams.set(epCode, epVar);
      }
      this._operationEndpointParamVar.set(operationName, epVar);

      const mwCode = this._buildMiddlewareCode(operation);
      let mwVar = this._uniqueMiddlewares.get(mwCode);
      if (mwVar === undefined) {
        mwVar = "_mw" + this._mwCounter++;
        this._uniqueMiddlewares.set(mwCode, mwVar);
      }
      this._operationMiddlewareVar.set(operationName, mwVar);
    }
  }

  public getEndpointParamVar(operation: OperationShape): string | undefined {
    return this._operationEndpointParamVar.get(operation.toShapeId().getName());
  }

  public getMiddlewareVar(operation: OperationShape): string | undefined {
    return this._operationMiddlewareVar.get(operation.toShapeId().getName());
  }

  public generate(delegator: TypeScriptDelegator): void {
    delegator.useFileWriter([CodegenUtils.SOURCE_FOLDER, COMMAND_BUILDER_FILENAME].join("/"), (writer) =>
      this._generateContent(writer)
    );
  }

  private _generateContent(writer: TypeScriptWriter): void {
    const serviceSymbol = this._symbolProvider.toSymbol(this._service);
    const clientName = serviceSymbol.getName();
    const serviceShapeName = this._service.toShapeId().getName();
    const configType = ServiceBareBonesClientGenerator.getResolvedConfigTypeName(serviceSymbol);
    writer.addImportSubmodule("makeBuilder", null, TypeScriptDependency.SMITHY_CORE, SmithyCoreSubmodules.CLIENT);
    writer.addImportSubmodule(
      "getEndpointPlugin",
      null,
      TypeScriptDependency.SMITHY_CORE,
      SmithyCoreSubmodules.ENDPOINTS
    );
    writer.addRelativeImport("commonParams", null, "./src/endpoint/EndpointParameters");
    const servicePath = "./" + [CodegenUtils.SOURCE_FOLDER, clientName].join("/");
    writer.addRelativeTypeImport(configType, null, servicePath);
    writer.addRelativeTypeImport("ServiceInputTypes", null, servicePath);
    writer.addRelativeTypeImport("ServiceOutputTypes", null, servicePath);
    writer.addTypeImport("EndpointParameterInstructions", null, TypeScriptDependency.SMITHY_TYPES);
    this._collectPluginImports(writer);

    writer.write("");
    writer.writeDocs("@internal");
    writer.write(
      "export const command = makeBuilder<$L, ServiceInputTypes, ServiceOutputTypes>(commonParams, $S, $S, getEndpointPlugin);",
      configType,
      serviceShapeName,
      clientName
    );
    writer.write("");
    for (const [code, variable] of this._uniqueEndpointParams) {
      writer.writeDocs("@internal");
      writer.write("export const $L: EndpointParameterInstructions = $L;", variable, code);
      writer.write("");
    }
    for (const [code, variable] of this._uniqueMiddlewares) {
      writer.writeDocs("@internal");
      writer.write("export const $L = $L;", variable, code);
      writer.write("");
    }
  }

  private _buildEndpointParamsCode(parameterFinder: RuleSetParameterFinder, operation: OperationShape): string {
    const staticContextParamValues = parameterFinder.getStaticContextParamValues(operation);
    const contextParams = parameterFinder.getContextParams(this._model.getShape(operation.getInputShape())!);
    const operationContextParamValues = parameterFinder.getOperationContextParamValues(operation);
    if (staticContextParamValues.size === 0 && contextParams.size === 0 && operationContextParamValues.size === 0) {
      return "{}";
    }
    let sb = "{\n";
    const paramNames = new Set<string>();
    for (const [name, value] of staticContextParamValues.entries()) {
      paramNames.add(name);
      sb += `  ${name}: { type: "staticContextParams", value: ${value} },\n`;
    }
    for (const [name, memberName] of contextParams.entries()) {
      if (!paramNames.has(name)) {
        sb += `  ${name}: { type: "contextParams", name: "${memberName}" },\n`;
      }
      paramNames.add(name);
    }
    for (const [name, jmesPathForInputInJs] of operationContextParamValues.entries()) {
      sb += `  ${name}: { type: "operationContextParams", get: (input?: any) => ${jmesPathForInputInJs} },\n`;
    }
    return sb + "}";
  }

  private _buildMiddlewareCode(operation: OperationShape): string {
    const operationPlugins = this._runtimePlugins
      .filter((plugin) => plugin.matchesOperation(this._model, this._service, operation))
      .filter((plugin) => plugin.getPluginFunction() !== undefined);
    let body = "";
    for (const plugin of operationPlugins) {
      const pluginName = plugin.getPluginFunction()!.getAlias();
      const params = this._buildPluginParams(plugin, operation);
      body += "  " + pluginName + "(config";
      if (params !== "") {
        body += ", " + params;
      }
      body += "),\n";
    }
    const usesThis = body.includes("this");
    let sb = "";
    if (usesThis) {
      sb += "function(Command: any, cs: any, config: any, o: any) {\n  return [\n";
    } else {
      sb += "(Command: any, cs: any, config: any, o: any) => [\n";
    }
    sb += body;
    sb += usesThis ? "  ];\n}" : "]";
    return sb;
  }

  private _buildPluginParams(plugin: RuntimeClientPlugin, operation: OperationShape): string {
    const additionalParams = plugin.getAdditionalPluginFunctionParameters(this._model, this._service, operation);
    if (additionalParams.size === 0) {
      return "";
    }
    let sb = "{\n";
    for (const [key, value] of additionalParams) {
      sb += `    ${key}: ${this._formatValue(value)},\n`;
    }
    return sb + "  }";
  }

  private _formatValue(value: unknown): string {
    if (typeof value === "string") {
      return `"${value}"`;
    }
    if (typeof value === "boolean" || typeof value === "number") {
      return String(value);
    }
    if (Array.isArray(value)) {
      return "[" + value.map((v) => this._formatValue(v)).join(", ") + "]";
    }
    if (value instanceof Map) {
      let sb = "{ ";
      for (const [k, v] of value) {
        sb += `"${k}": ${this._formatValue(v)}, `;
      }
      return sb + "}";
    }
    if (isSymbol(value)) {
      return value.getName();
    }
    return String(value);
  }

  private _collectPluginImports(writer: TypeScriptWriter): void {
    const pluginNames = new Set<string>();
    const refs: SymbolReference[] = [];
    for (const operation of TopDownIndex.of(this._model).getContainedOperations(this._service)) {
      for (const plugin of this._runtimePlugins) {
        if (!plugin.matchesOperation(this._model, this._service, operation)) {
          continue;
        }
        const pluginSymbolRef = plugin.getPluginFunction();
        if (pluginSymbolRef !== undefined) {
          const alias = pluginSymbolRef.getAlias();
          if (!pluginNames.has(alias)) {
            pluginNames.add(alias);
            refs.push(pluginSymbolRef);
          }
        }
      }
    }
    for (const ref of refs) {
      const symbol = ref.getSymbol();
      const from = symbol.getNamespace();
      const name = ref.getAlias();
      for (const dependency of symbol.getDependencies()) {
        writer.addDependency(dependency);
      }
      if (from.startsWith("./")) {
        writer.addRelativeImport(name, null, from);
      } else {
        writer.addImport(name, null, from);
      }
    }
  }
}
