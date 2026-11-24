import type { Symbol } from "../../../codegen-core";
import { TypeScriptDependency } from "../../TypeScriptDependency";
import type { TypeScriptWriter } from "../../TypeScriptWriter";

type ConfigFieldType = "MAIN" | "AUXILIARY";

interface ConfigFieldInit {
  name: string;
  type: ConfigFieldType;
  inputType: Symbol;
  resolvedType: Symbol;
  configFieldWriter?: (writer: TypeScriptWriter, configField: ConfigField) => void;
  docs?: (writer: TypeScriptWriter) => void;
}

/**
 * A client config field contributed by an auth scheme.
 *
 * @internal
 */
export class ConfigField {
  public readonly name: string;
  public readonly type: ConfigFieldType;
  public readonly inputType: Symbol;
  public readonly resolvedType: Symbol;
  public readonly configFieldWriter: ((writer: TypeScriptWriter, configField: ConfigField) => void) | undefined;
  public readonly docs: ((writer: TypeScriptWriter) => void) | undefined;

  public constructor(init: ConfigFieldInit) {
    this.name = init.name;
    this.type = init.type;
    this.inputType = init.inputType;
    this.resolvedType = init.resolvedType;
    this.configFieldWriter = init.configFieldWriter;
    this.docs = init.docs;
  }

  public static builder(): ConfigFieldBuilder {
    return new ConfigFieldBuilder();
  }

  public static defaultMainConfigFieldWriter(w: TypeScriptWriter, configField: ConfigField): void {
    w.addDependency(TypeScriptDependency.SMITHY_CORE);
    w.addImport("memoizeIdentityProvider", null, TypeScriptDependency.SMITHY_CORE);
    w.addImport("isIdentityExpired", null, TypeScriptDependency.SMITHY_CORE);
    w.addImport("doesIdentityRequireRefresh", null, TypeScriptDependency.SMITHY_CORE);
    w.write(
      "const $L = memoizeIdentityProvider(config.$L, isIdentityExpired, doesIdentityRequireRefresh);",
      configField.name,
      configField.name
    );
  }
}

class ConfigFieldBuilder {
  private _init: Partial<ConfigFieldInit>;

  public constructor(init: Partial<ConfigFieldInit> = {}) {
    this._init = { ...init };
  }

  public build(): ConfigField {
    for (const key of ["name", "type", "inputType", "resolvedType"] as const) {
      if (this._init[key] === undefined) {
        throw new Error(`Missing required state: ${key}`);
      }
    }
    return new ConfigField(this._init as ConfigFieldInit);
  }

  public name(name: string): this {
    this._init.name = name;
    return this;
  }

  public type(type: ConfigFieldType): this {
    this._init.type = type;
    return this;
  }

  public inputType(inputType: Symbol): this {
    this._init.inputType = inputType;
    return this;
  }

  public resolvedType(resolvedType: Symbol): this {
    this._init.resolvedType = resolvedType;
    return this;
  }

  public docs(docs: ((writer: TypeScriptWriter) => void) | undefined): this {
    this._init.docs = docs;
    return this;
  }

  public configFieldWriter(writer: ((writer: TypeScriptWriter, configField: ConfigField) => void) | undefined): this {
    this._init.configFieldWriter = writer;
    return this;
  }
}
