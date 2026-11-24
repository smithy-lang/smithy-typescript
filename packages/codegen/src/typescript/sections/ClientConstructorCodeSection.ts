import type { CodeSection } from "../../codegen-core";
import type { Model, RuntimeClientPlugin, ServiceShape } from "./SectionTypes";

interface ClientConstructorCodeSectionProps {
  service: ServiceShape;
  runtimeClientPlugins: RuntimeClientPlugin[];
  model: Model;
}

/**
 * Extension point for integrations.
 *
 * @internal
 */
export class ClientConstructorCodeSection implements CodeSection {
  public static readonly SECTION_NAME =
    "software.amazon.smithy.typescript.codegen.sections.ClientConstructorCodeSection";

  private readonly _props: ClientConstructorCodeSectionProps;

  public constructor(props: ClientConstructorCodeSectionProps) {
    if (props.service === undefined) {
      throw new Error("service is required");
    }
    if (props.runtimeClientPlugins === undefined) {
      throw new Error("runtimeClientPlugins is required");
    }
    if (props.model === undefined) {
      throw new Error("model is required");
    }
    this._props = props;
  }

  public static builder(): ClientConstructorCodeSectionBuilder {
    return new ClientConstructorCodeSectionBuilder();
  }

  public sectionName(): string {
    return ClientConstructorCodeSection.SECTION_NAME;
  }
}

class ClientConstructorCodeSectionBuilder {
  private readonly _props: Partial<ClientConstructorCodeSectionProps> = {};

  public build(): ClientConstructorCodeSection {
    return new ClientConstructorCodeSection(this._props as ClientConstructorCodeSectionProps);
  }

  public service(service: ServiceShape): this {
    this._props.service = service;
    return this;
  }

  public runtimeClientPlugins(runtimeClientPlugins: RuntimeClientPlugin[]): this {
    this._props.runtimeClientPlugins = runtimeClientPlugins;
    return this;
  }

  public model(model: Model): this {
    this._props.model = model;
    return this;
  }
}
