import type { CodeSection } from "../../codegen-core";
import type {
  ApplicationProtocol,
  Model,
  ServiceShape,
  SymbolProvider,
  TypeScriptIntegration,
  TypeScriptSettings,
} from "./SectionTypes";

interface ClientPropertiesCodeSectionProps {
  settings: TypeScriptSettings;
  model: Model;
  service: ServiceShape;
  symbolProvider: SymbolProvider;
  integrations: TypeScriptIntegration[];
  applicationProtocol: ApplicationProtocol;
}

/**
 * Extension point for integrations.
 *
 * @internal
 */
export class ClientPropertiesCodeSection implements CodeSection {
  public static readonly SECTION_NAME =
    "software.amazon.smithy.typescript.codegen.sections.ClientPropertiesCodeSection";

  private readonly _props: ClientPropertiesCodeSectionProps;

  public constructor(props: ClientPropertiesCodeSectionProps) {
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
    if (props.applicationProtocol === undefined) {
      throw new Error("applicationProtocol is required");
    }
    this._props = props;
  }

  public static builder(): ClientPropertiesCodeSectionBuilder {
    return new ClientPropertiesCodeSectionBuilder();
  }

  public sectionName(): string {
    return ClientPropertiesCodeSection.SECTION_NAME;
  }
}

class ClientPropertiesCodeSectionBuilder {
  private readonly _props: Partial<ClientPropertiesCodeSectionProps> = {};

  public build(): ClientPropertiesCodeSection {
    return new ClientPropertiesCodeSection(this._props as ClientPropertiesCodeSectionProps);
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

  public applicationProtocol(applicationProtocol: ApplicationProtocol): this {
    this._props.applicationProtocol = applicationProtocol;
    return this;
  }
}
