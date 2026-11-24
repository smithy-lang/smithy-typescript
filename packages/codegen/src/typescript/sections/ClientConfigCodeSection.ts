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

interface ClientConfigCodeSectionProps {
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
export class ClientConfigCodeSection implements CodeSection {
  public static readonly SECTION_NAME = "software.amazon.smithy.typescript.codegen.sections.ClientConfigCodeSection";

  private readonly _props: ClientConfigCodeSectionProps;

  public constructor(props: ClientConfigCodeSectionProps) {
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

  public static builder(): ClientConfigCodeSectionBuilder {
    return new ClientConfigCodeSectionBuilder();
  }

  public sectionName(): string {
    return ClientConfigCodeSection.SECTION_NAME;
  }
}

class ClientConfigCodeSectionBuilder {
  private readonly _props: Partial<ClientConfigCodeSectionProps> = {};

  public build(): ClientConfigCodeSection {
    return new ClientConfigCodeSection(this._props as ClientConfigCodeSectionProps);
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
