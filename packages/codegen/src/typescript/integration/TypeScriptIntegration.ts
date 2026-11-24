import type { CodeInterceptor, SymbolProvider } from "../../codegen-core";
import type { Model } from "../../model";
import type { ExtensionConfigurationInterface } from "../extensions/ExtensionConfigurationInterface";
import type { LanguageTarget } from "../LanguageTarget";
import type { TypeScriptCodegenContext } from "../TypeScriptCodegenContext";
import type { TypeScriptSettings } from "../TypeScriptSettings";
import type { TypeScriptWriter } from "../TypeScriptWriter";
import type { ProtocolGenerator } from "./ProtocolGenerator";
import type { RuntimeClientPlugin } from "./RuntimeClientPlugin";

/**
 * Extension point that customizes generated TypeScript clients.
 *
 * @internal
 */
export abstract class TypeScriptIntegration {
  public name(): string {
    return this.constructor.name;
  }

  public priority(): number {
    return 0;
  }

  public runBefore(): string[] {
    return [];
  }

  public runAfter(): string[] {
    return [];
  }

  public matchesSettings(_settings: TypeScriptSettings): boolean {
    return true;
  }

  public preprocessModel(model: Model, _settings: TypeScriptSettings): Model {
    return model;
  }

  public decorateSymbolProvider(
    _model: Model,
    _settings: TypeScriptSettings,
    symbolProvider: SymbolProvider
  ): SymbolProvider {
    return symbolProvider;
  }

  public interceptors(_context: TypeScriptCodegenContext): CodeInterceptor<any, TypeScriptWriter>[] {
    return [];
  }

  public customize(_context: TypeScriptCodegenContext): void {}

  public getClientPlugins(): RuntimeClientPlugin[] {
    return [];
  }

  public mutateClientPlugins(_plugins: RuntimeClientPlugin[]): void {}

  public getProtocolGenerators(): ProtocolGenerator[] {
    return [];
  }

  public addConfigInterfaceFields(
    _settings: TypeScriptSettings,
    _model: Model,
    _symbolProvider: SymbolProvider,
    _writer: TypeScriptWriter
  ): void {}

  public getRuntimeConfigWriters(
    _settings: TypeScriptSettings,
    _model: Model,
    _symbolProvider: SymbolProvider,
    _target: LanguageTarget
  ): Map<string, (writer: TypeScriptWriter) => void> {
    return new Map();
  }

  public getExtensionConfigurationInterfaces(
    _model: Model,
    _settings: TypeScriptSettings
  ): ExtensionConfigurationInterface[] {
    return [];
  }

  public prepareCustomizations(
    _writer: TypeScriptWriter,
    _target: LanguageTarget,
    _settings: TypeScriptSettings,
    _model: Model
  ): void {}
}
