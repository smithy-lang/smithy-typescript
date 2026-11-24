import type { CodeSection } from "../../codegen-core";
import type { RuntimeClientPlugin } from "./SectionTypes";

interface ClientDestroyCodeSectionProps {
  runtimeClientPlugins: RuntimeClientPlugin[];
}

/**
 * Extension point for integrations.
 *
 * @internal
 */
export class ClientDestroyCodeSection implements CodeSection {
  public static readonly SECTION_NAME = "software.amazon.smithy.typescript.codegen.sections.ClientDestroyCodeSection";

  private readonly _props: ClientDestroyCodeSectionProps;

  public constructor(props: ClientDestroyCodeSectionProps) {
    if (props.runtimeClientPlugins === undefined) {
      throw new Error("runtimeClientPlugins is required");
    }
    this._props = props;
  }

  public static builder(): ClientDestroyCodeSectionBuilder {
    return new ClientDestroyCodeSectionBuilder();
  }

  public sectionName(): string {
    return ClientDestroyCodeSection.SECTION_NAME;
  }
}

class ClientDestroyCodeSectionBuilder {
  private readonly _props: Partial<ClientDestroyCodeSectionProps> = {};

  public build(): ClientDestroyCodeSection {
    return new ClientDestroyCodeSection(this._props as ClientDestroyCodeSectionProps);
  }

  public runtimeClientPlugins(runtimeClientPlugins: RuntimeClientPlugin[]): this {
    this._props.runtimeClientPlugins = runtimeClientPlugins;
    return this;
  }
}
