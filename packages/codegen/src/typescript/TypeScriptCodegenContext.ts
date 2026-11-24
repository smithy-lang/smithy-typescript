import type { FileManifest, SymbolProvider } from "../codegen-core";
import type { Model } from "../model";
import type { ApplicationProtocol } from "./ApplicationProtocol";
import type { ProtocolGenerator } from "./integration/ProtocolGenerator";
import type { RuntimeClientPlugin } from "./integration/RuntimeClientPlugin";
import type { TypeScriptIntegration } from "./integration/TypeScriptIntegration";
import type { TypeScriptDelegator } from "./TypeScriptDelegator";
import type { TypeScriptSettings } from "./TypeScriptSettings";

interface TypeScriptCodegenContextInit {
  model: Model;
  settings: TypeScriptSettings;
  symbolProvider: SymbolProvider;
  fileManifest: FileManifest;
  writerDelegator: TypeScriptDelegator;
  integrations: TypeScriptIntegration[];
  runtimePlugins: RuntimeClientPlugin[];
  protocolGenerator?: ProtocolGenerator;
  applicationProtocol: ApplicationProtocol;
}

/**
 * State shared by generators during a single codegen run.
 *
 * @internal
 */
export class TypeScriptCodegenContext {
  private readonly _init: TypeScriptCodegenContextInit;

  public constructor(init: TypeScriptCodegenContextInit) {
    this._init = init;
  }

  public model(): Model {
    return this._init.model;
  }

  public settings(): TypeScriptSettings {
    return this._init.settings;
  }

  public symbolProvider(): SymbolProvider {
    return this._init.symbolProvider;
  }

  public fileManifest(): FileManifest {
    return this._init.fileManifest;
  }

  public writerDelegator(): TypeScriptDelegator {
    return this._init.writerDelegator;
  }

  public integrations(): TypeScriptIntegration[] {
    return this._init.integrations;
  }

  public runtimePlugins(): RuntimeClientPlugin[] {
    return this._init.runtimePlugins;
  }

  public protocolGenerator(): ProtocolGenerator | undefined {
    return this._init.protocolGenerator;
  }

  public applicationProtocol(): ApplicationProtocol {
    return this._init.applicationProtocol;
  }
}
