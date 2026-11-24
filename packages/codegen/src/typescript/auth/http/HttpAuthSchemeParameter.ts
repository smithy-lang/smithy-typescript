import type { TypeScriptWriter } from "../../TypeScriptWriter";

type WriterConsumer = (writer: TypeScriptWriter) => void;

/**
 * A parameter of the generated HttpAuthSchemeParameters interface.
 *
 * @internal
 */
export class HttpAuthSchemeParameter {
  public constructor(
    public readonly name: string,
    public readonly type: WriterConsumer,
    public readonly source: WriterConsumer
  ) {}

  public static builder(): HttpAuthSchemeParameterBuilder {
    return new HttpAuthSchemeParameterBuilder();
  }
}

class HttpAuthSchemeParameterBuilder {
  private _name: string | undefined;
  private _type: WriterConsumer | undefined;

  public name(name: string): this {
    this._name = name;
    return this;
  }

  public type(type: WriterConsumer): this {
    this._type = type;
    return this;
  }
}
