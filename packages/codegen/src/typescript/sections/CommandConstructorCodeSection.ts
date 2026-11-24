import type { CodeSection } from "../../codegen-core";
import type {
  ApplicationProtocol,
  Model,
  OperationShape,
  ProtocolGenerator,
  RuntimeClientPlugin,
  ServiceShape,
  SymbolProvider,
  TypeScriptSettings,
} from "./SectionTypes";

interface CommandConstructorCodeSectionProps {
  settings: TypeScriptSettings;
  model: Model;
  service: ServiceShape;
  operation: OperationShape;
  symbolProvider: SymbolProvider;
  runtimeClientPlugins: RuntimeClientPlugin[];
  protocolGenerator?: ProtocolGenerator;
  applicationProtocol: ApplicationProtocol;
}

/**
 * Extension point for integrations.
 *
 * @internal
 */
export class CommandConstructorCodeSection implements CodeSection {
  public static readonly SECTION_NAME =
    "software.amazon.smithy.typescript.codegen.sections.CommandConstructorCodeSection";

  private readonly _props: CommandConstructorCodeSectionProps;

  public constructor(props: CommandConstructorCodeSectionProps) {
    if (props.settings === undefined) {
      throw new Error("settings is required");
    }
    if (props.model === undefined) {
      throw new Error("model is required");
    }
    if (props.service === undefined) {
      throw new Error("service is required");
    }
    if (props.operation === undefined) {
      throw new Error("operation is required");
    }
    if (props.symbolProvider === undefined) {
      throw new Error("symbolProvider is required");
    }
    if (props.runtimeClientPlugins === undefined) {
      throw new Error("runtimeClientPlugins is required");
    }
    if (props.applicationProtocol === undefined) {
      throw new Error("applicationProtocol is required");
    }
    this._props = props;
  }

  public static builder(): CommandConstructorCodeSectionBuilder {
    return new CommandConstructorCodeSectionBuilder();
  }

  public sectionName(): string {
    return CommandConstructorCodeSection.SECTION_NAME;
  }
}

class CommandConstructorCodeSectionBuilder {
  private readonly _props: Partial<CommandConstructorCodeSectionProps> = {};

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

  public operation(operation: OperationShape): this {
    this._props.operation = operation;
    return this;
  }

  public symbolProvider(symbolProvider: SymbolProvider): this {
    this._props.symbolProvider = symbolProvider;
    return this;
  }

  public runtimeClientPlugins(runtimeClientPlugins: RuntimeClientPlugin[]): this {
    this._props.runtimeClientPlugins = runtimeClientPlugins;
    return this;
  }

  public protocolGenerator(protocolGenerator: ProtocolGenerator): this {
    this._props.protocolGenerator = protocolGenerator;
    return this;
  }

  public applicationProtocol(applicationProtocol: ApplicationProtocol): this {
    this._props.applicationProtocol = applicationProtocol;
    return this;
  }
}
