import type { SymbolProvider } from "../../codegen-core";
import type { Model, ServiceShape, ShapeId } from "../../model";
import { CaseUtils } from "../../model";
import type { ApplicationProtocol } from "../ApplicationProtocol";
import type { TypeScriptDelegator } from "../TypeScriptDelegator";
import type { TypeScriptSettings } from "../TypeScriptSettings";
import type { TypeScriptWriter } from "../TypeScriptWriter";
import { StringStore } from "../util";

/**
 * Generates protocol-specific serde and test code for a service.
 *
 * @internal
 */
export abstract class ProtocolGenerator {
  public static getSanitizedName(name: string): string {
    return CaseUtils.toCamelCase(name.replace(/\./g, "_"), true, ["-"]);
  }

  public abstract getProtocol(): ShapeId;

  public abstract getApplicationProtocol(): ApplicationProtocol;

  public getName(): string {
    return this.getProtocol().getName();
  }

  public abstract generateProtocolTests(context: GenerationContext): void;
}

/**
 * Context handed to protocol generators while writing a file.
 *
 * @internal
 */
export class GenerationContext {
  private _settings!: TypeScriptSettings;
  private _model!: Model;
  private _service!: ServiceShape;
  private _symbolProvider!: SymbolProvider;
  private _writerDelegator: TypeScriptDelegator | undefined;
  private _writer: TypeScriptWriter | undefined;
  private _protocolName!: string;
  private readonly _stringStore = new StringStore();

  public getSettings(): TypeScriptSettings {
    return this._settings;
  }

  public setSettings(settings: TypeScriptSettings): void {
    this._settings = settings;
  }

  public getModel(): Model {
    return this._model;
  }

  public setModel(model: Model): void {
    this._model = model;
  }

  public setService(service: ServiceShape): void {
    this._service = service;
  }

  public getSymbolProvider(): SymbolProvider {
    return this._symbolProvider;
  }

  public setSymbolProvider(symbolProvider: SymbolProvider): void {
    this._symbolProvider = symbolProvider;
  }

  public getWriterDelegator(): TypeScriptDelegator | undefined {
    return this._writerDelegator;
  }

  public setWriterDelegator(writerDelegator: TypeScriptDelegator | undefined): void {
    this._writerDelegator = writerDelegator;
    if (writerDelegator !== undefined) {
      this._writer = undefined;
    }
  }

  public setProtocolName(protocolName: string): void {
    this._protocolName = protocolName;
  }
}
