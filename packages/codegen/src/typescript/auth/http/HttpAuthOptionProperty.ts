import type { Trait } from "../../../model";
import type { TypeScriptWriter } from "../../TypeScriptWriter";
import type { HttpAuthScheme } from "./HttpAuthScheme";

/**
 * @internal
 */
export type HttpAuthOptionPropertyType = "IDENTITY" | "SIGNING";

interface HttpAuthOptionPropertySource {
  httpAuthScheme: HttpAuthScheme;
  trait: Trait;
}

type SourceFn = (source: HttpAuthOptionPropertySource) => (writer: TypeScriptWriter) => void;

/**
 * A property added to the options of an auth scheme.
 *
 * @internal
 */
export class HttpAuthOptionProperty {
  public constructor(
    public readonly name: string,
    public readonly type: HttpAuthOptionPropertyType,
    public readonly source: SourceFn
  ) {}

  public static builder(): HttpAuthOptionPropertyBuilder {
    return new HttpAuthOptionPropertyBuilder();
  }
}

class HttpAuthOptionPropertyBuilder {
  private _name: string | undefined;
  private _type: HttpAuthOptionPropertyType | undefined;
  private _source: SourceFn | undefined;

  public build(): HttpAuthOptionProperty {
    if (this._name === undefined || this._type === undefined || this._source === undefined) {
      throw new Error("Missing required state for HttpAuthOptionProperty");
    }
    return new HttpAuthOptionProperty(this._name, this._type, this._source);
  }

  public name(name: string): this {
    this._name = name;
    return this;
  }

  public type(type: HttpAuthOptionPropertyType): this {
    this._type = type;
    return this;
  }

  public source(source: SourceFn): this {
    this._source = source;
    return this;
  }
}
