import type { CodeSection } from "../../codegen-core";
import type {
  ApplicationProtocol,
  Model,
  RuntimeClientPlugin,
  ServiceShape,
  SymbolProvider,
  TypeScriptIntegration,
  TypeScriptSettings,
} from "./SectionTypes";

interface ClientBodyExtraCodeSectionProps {
  settings: TypeScriptSettings;
  model: Model;
  service: ServiceShape;
  symbolProvider: SymbolProvider;
  integrations: TypeScriptIntegration[];
  runtimeClientPlugins: RuntimeClientPlugin[];
  applicationProtocol: ApplicationProtocol;
}

/**
 * Extension point for integrations.
 *
 * @internal
 */
export class ClientBodyExtraCodeSection implements CodeSection {
  public static readonly SECTION_NAME = "software.amazon.smithy.typescript.codegen.sections.ClientBodyExtraCodeSection";

  private readonly _props: ClientBodyExtraCodeSectionProps;

  public constructor(props: ClientBodyExtraCodeSectionProps) {
    if (props.settings === undefined) {
      throw new Error("settings is required");
    }
    if (props.model === undefined) {
      throw new Error("model is required");
    }
    if (props.service === undefined) {
      throw new Error("service is required");
    }
    if (props.symbolProvider === undefined) {
      throw new Error("symbolProvider is required");
    }
    if (props.integrations === undefined) {
      throw new Error("integrations is required");
    }
    if (props.runtimeClientPlugins === undefined) {
      throw new Error("runtimeClientPlugins is required");
    }
    if (props.applicationProtocol === undefined) {
      throw new Error("applicationProtocol is required");
    }
    this._props = props;
  }

  public static builder(): ClientBodyExtraCodeSectionBuilder {
    return new ClientBodyExtraCodeSectionBuilder();
  }

  public sectionName(): string {
    return ClientBodyExtraCodeSection.SECTION_NAME;
  }

  public getSettings(): TypeScriptSettings {
    return this._props.settings;
  }

  public getModel(): Model {
    return this._props.model;
  }

  public getService(): ServiceShape {
    return this._props.service;
  }

  public getSymbolProvider(): SymbolProvider {
    return this._props.symbolProvider;
  }

  public getIntegrations(): TypeScriptIntegration[] {
    return this._props.integrations;
  }
}

class ClientBodyExtraCodeSectionBuilder {
  private readonly _props: Partial<ClientBodyExtraCodeSectionProps> = {};

  public build(): ClientBodyExtraCodeSection {
    return new ClientBodyExtraCodeSection(this._props as ClientBodyExtraCodeSectionProps);
  }

  public settings(settings: TypeScriptSettings): this {
    this._props.settings = settings;
    return this;
  }

  public model(model: Model): this {
    this._props.model = model;
    return this;
  }

  public service(service: ServiceShape): this {
    this._props.service = service;
    return this;
  }

  public symbolProvider(symbolProvider: SymbolProvider): this {
    this._props.symbolProvider = symbolProvider;
    return this;
  }

  public integrations(integrations: TypeScriptIntegration[]): this {
    this._props.integrations = integrations;
    return this;
  }

  public runtimeClientPlugins(runtimeClientPlugins: RuntimeClientPlugin[]): this {
    this._props.runtimeClientPlugins = runtimeClientPlugins;
    return this;
  }

  public applicationProtocol(applicationProtocol: ApplicationProtocol): this {
    this._props.applicationProtocol = applicationProtocol;
    return this;
  }
}
