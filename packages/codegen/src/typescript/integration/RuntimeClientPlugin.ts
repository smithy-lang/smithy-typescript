import { type Model, type OperationShape, type ServiceShape, TreeMap } from "../../model";
import type { SymbolDependency } from "../../codegen-core";
import { Symbol, SymbolReference } from "../../codegen-core";
import type { ClientWriterConsumer, CommandWriterConsumer } from "../util";
import type { TypeScriptSettings } from "../TypeScriptSettings";
import { TypeScriptDependency } from "../TypeScriptDependency";

type OperationPredicate = (model: Model, service: ServiceShape, operation: OperationShape) => boolean;
type SettingsPredicate = (model: Model, service: ServiceShape, settings: TypeScriptSettings) => boolean;
type FunctionParamsSupplier = (model: Model, service: ServiceShape, operation: OperationShape) => Map<string, unknown>;
type ServicePredicate = (model: Model, service: ServiceShape) => boolean;

type Convention = "HAS_CONFIG" | "HAS_MIDDLEWARE" | "HAS_DESTROY";
const DEFAULT_CONVENTIONS: Convention[] = ["HAS_CONFIG", "HAS_MIDDLEWARE"];

/**
 * Plugin that contributes config, middleware or lifecycle hooks to generated clients and commands.
 *
 * @internal
 */
export class RuntimeClientPlugin {
  private readonly _inputConfig: SymbolReference | undefined;
  private readonly _resolvedConfig: SymbolReference | undefined;
  private readonly _resolveFunction: SymbolReference | undefined;
  private readonly _additionalResolveFunctionParamsSupplier: FunctionParamsSupplier | undefined;
  private readonly _pluginFunction: SymbolReference | undefined;
  private readonly _additionalPluginFunctionParamsSupplier: FunctionParamsSupplier | undefined;
  private readonly _destroyFunction: SymbolReference | undefined;
  private readonly _servicePredicate: ServicePredicate;
  private readonly _operationPredicate: OperationPredicate;
  private readonly _settingsPredicate: SettingsPredicate;
  private readonly _writeAdditionalClientParams: Map<string, ClientWriterConsumer>;
  private readonly _writeAdditionalOperationParams: Map<string, CommandWriterConsumer>;

  public constructor(builder: RuntimeClientPluginBuilder) {
    this._inputConfig = builder._inputConfig;
    this._resolvedConfig = builder._resolvedConfig;
    this._resolveFunction = builder._resolveFunction;
    this._additionalResolveFunctionParamsSupplier = builder._additionalResolveFunctionParamsSupplier;
    this._pluginFunction = builder._pluginFunction;
    this._additionalPluginFunctionParamsSupplier = builder._additionalPluginFunctionParamsSupplier;
    this._destroyFunction = builder._destroyFunction;
    this._operationPredicate = builder._operationPredicate;
    this._servicePredicate = builder._servicePredicate;
    this._settingsPredicate = builder._settingsPredicate;
    this._writeAdditionalClientParams = builder._writeAdditionalClientParams;
    this._writeAdditionalOperationParams = builder._writeAdditionalOperationParams;

    const allNull = !this._inputConfig && !this._resolvedConfig && !this._resolveFunction;
    const allSet = !!this._inputConfig && !!this._resolvedConfig && !!this._resolveFunction;
    if (!(allNull || allSet)) {
      throw new Error(
        "If any of inputConfig, resolvedConfig, or resolveFunction are set, then all of inputConfig, resolvedConfig, and resolveFunction must be set"
      );
    }
    if (this._destroyFunction && !this._resolvedConfig) {
      throw new Error("resolvedConfig must be set if destroyFunction is set");
    }
  }

  public static builder(): RuntimeClientPluginBuilder {
    return new RuntimeClientPluginBuilder();
  }

  public getInputConfig(): SymbolReference | undefined {
    return this._inputConfig;
  }

  public getResolvedConfig(): SymbolReference | undefined {
    return this._resolvedConfig;
  }

  public getResolveFunction(): SymbolReference | undefined {
    return this._resolveFunction;
  }

  public getAdditionalResolveFunctionParameters(
    model: Model,
    service: ServiceShape,
    operation: OperationShape
  ): Map<string, unknown> {
    return this._additionalResolveFunctionParamsSupplier?.(model, service, operation) ?? new Map();
  }

  public getPluginFunction(): SymbolReference | undefined {
    return this._pluginFunction;
  }

  public getAdditionalPluginFunctionParameters(
    model: Model,
    service: ServiceShape,
    operation: OperationShape
  ): Map<string, unknown> {
    return this._additionalPluginFunctionParamsSupplier?.(model, service, operation) ?? new Map();
  }

  public getDestroyFunction(): SymbolReference | undefined {
    return this._destroyFunction;
  }

  public matchesService(model: Model, service: ServiceShape): boolean {
    return this._servicePredicate(model, service);
  }

  public matchesOperation(model: Model, service: ServiceShape, operation: OperationShape): boolean {
    return this._operationPredicate(model, service, operation);
  }

  public matchesSettings(model: Model, service: ServiceShape, settings: TypeScriptSettings): boolean {
    return this._settingsPredicate(model, service, settings);
  }

  public getClientAddParamsWriterConsumers(): Map<string, ClientWriterConsumer> {
    return this._writeAdditionalClientParams;
  }

  public toString(): string {
    return `RuntimeClientPlugin{inputConfig=${this._inputConfig}, resolvedConfig=${this._resolvedConfig}, resolveFunction=${this._resolveFunction}, pluginFunction=${this._pluginFunction}, destroyFunction=${this._destroyFunction}}`;
  }
}

class RuntimeClientPluginBuilder {
  public _inputConfig: SymbolReference | undefined;
  public _resolvedConfig: SymbolReference | undefined;
  public _resolveFunction: SymbolReference | undefined;
  public _additionalResolveFunctionParamsSupplier: FunctionParamsSupplier | undefined;
  public _pluginFunction: SymbolReference | undefined;
  public _additionalPluginFunctionParamsSupplier: FunctionParamsSupplier | undefined;
  public _destroyFunction: SymbolReference | undefined;
  public _servicePredicate: ServicePredicate = () => true;
  public _operationPredicate: OperationPredicate = () => false;
  public _settingsPredicate: SettingsPredicate = () => true;
  public _writeAdditionalClientParams = new TreeMap<string, ClientWriterConsumer>();
  public _writeAdditionalOperationParams = new TreeMap<string, CommandWriterConsumer>();

  public build(): RuntimeClientPlugin {
    return new RuntimeClientPlugin(this);
  }

  public inputConfig(inputConfig: SymbolReference | Symbol | undefined): this {
    this._inputConfig = RuntimeClientPluginBuilder._ref(inputConfig);
    return this;
  }

  public resolvedConfig(resolvedConfig: SymbolReference | Symbol | undefined): this {
    this._resolvedConfig = RuntimeClientPluginBuilder._ref(resolvedConfig);
    return this;
  }

  public resolveFunction(
    resolveFunction: SymbolReference | Symbol | undefined,
    additionalParamsSupplier?: FunctionParamsSupplier
  ): this {
    this._resolveFunction = RuntimeClientPluginBuilder._ref(resolveFunction);
    if (additionalParamsSupplier !== undefined) {
      this._additionalResolveFunctionParamsSupplier = additionalParamsSupplier;
    }
    return this;
  }

  public pluginFunction(
    pluginFunction: SymbolReference | Symbol | undefined,
    additionalParamsSupplier?: FunctionParamsSupplier
  ): this {
    this._pluginFunction = RuntimeClientPluginBuilder._ref(pluginFunction);
    if (additionalParamsSupplier !== undefined) {
      this._additionalPluginFunctionParamsSupplier = additionalParamsSupplier;
    }
    return this;
  }

  public additionalPluginFunctionParamsSupplier(supplier: FunctionParamsSupplier): this {
    this._additionalPluginFunctionParamsSupplier = supplier;
    return this;
  }

  public destroyFunction(destroyFunction: SymbolReference | Symbol | undefined): this {
    this._destroyFunction = RuntimeClientPluginBuilder._ref(destroyFunction);
    return this;
  }

  public operationPredicate(operationPredicate: OperationPredicate): this {
    this._operationPredicate = operationPredicate;
    this._servicePredicate = () => false;
    return this;
  }

  public servicePredicate(servicePredicate: ServicePredicate): this {
    this._servicePredicate = servicePredicate;
    this._operationPredicate = () => false;
    return this;
  }

  public withAdditionalClientParams(params: Map<string, ClientWriterConsumer>): this {
    this._writeAdditionalClientParams = new TreeMap(null, params);
    return this;
  }

  public withConventions(
    dependency: SymbolDependency | { packageName: string; version: string },
    pluginName: string,
    ...conventions: Convention[]
  ): this;
  public withConventions(packageName: string, version: string, pluginName: string, ...conventions: Convention[]): this;
  public withConventions(first: unknown, second: unknown, ...rest: unknown[]): this {
    let packageName: string;
    let version: string;
    let pluginName: string;
    let conventions: Convention[];
    if (typeof first === "string") {
      packageName = first;
      version = second as string;
      pluginName = rest[0] as string;
      conventions = rest.slice(1) as Convention[];
    } else {
      const dependency = first as { getPackageName(): string; getVersion(): string };
      packageName = dependency.getPackageName();
      version = dependency.getVersion();
      pluginName = second as string;
      conventions = rest as Convention[];
    }
    pluginName = pluginName.charAt(0).toUpperCase() + pluginName.slice(1);
    for (const convention of conventions.length === 0 ? DEFAULT_CONVENTIONS : conventions) {
      switch (convention) {
        case "HAS_CONFIG":
          this.inputConfig(createTypeSymbol(packageName, version, pluginName + "InputConfig"));
          this.resolvedConfig(createTypeSymbol(packageName, version, pluginName + "ResolvedConfig"));
          this.resolveFunction(createSymbol(packageName, version, "resolve" + pluginName + "Config"));
          break;
        case "HAS_MIDDLEWARE":
          this.pluginFunction(createSymbol(packageName, version, "get" + pluginName + "Plugin"));
          break;
        case "HAS_DESTROY":
          this.destroyFunction(createSymbol(packageName, version, "destroy" + pluginName));
          break;
      }
    }
    return this;
  }

  private static _ref(value: SymbolReference | Symbol | undefined): SymbolReference | undefined {
    if (value === undefined || value instanceof SymbolReference) {
      return value;
    }
    return SymbolReference.builder().symbol(value).build();
  }
}

const basePackageName = (packageName: string): string => {
  if (packageName.startsWith("@")) {
    const firstSlash = packageName.indexOf("/");
    const secondSlash = packageName.indexOf("/", firstSlash + 1);
    if (secondSlash > 0) {
      return packageName.substring(0, secondSlash);
    }
  }
  return packageName;
};

const createSymbol = (packageName: string, version: string, name: string): Symbol =>
  Symbol.builder()
    .namespace(packageName, "/")
    .name(name)
    .addDependency(TypeScriptDependency.NORMAL_DEPENDENCY, basePackageName(packageName), version)
    .build();

const createTypeSymbol = (packageName: string, version: string, name: string): Symbol =>
  Symbol.builder()
    .namespace(packageName, "/")
    .name(name)
    .putProperty("typeOnly", true)
    .addDependency(TypeScriptDependency.NORMAL_DEPENDENCY, basePackageName(packageName), version)
    .build();
