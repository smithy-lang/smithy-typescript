import { Nodes } from "../node/Nodes";
import { ShapeId } from "../shapes/ShapeId";
import { Trait } from "./Trait";

/**
 * @internal
 */
export class DeprecatedTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#deprecated");

  private readonly _since: string | undefined;
  private readonly _message: string | undefined;

  constructor(value?: unknown) {
    super(DeprecatedTrait.ID, value === undefined || value === null ? {} : value);
    const object = Nodes.expectObject(this.toNode());
    this._since = Nodes.getString(object, "since");
    this._message = Nodes.getString(object, "message");
  }

  public getSince(): string | undefined {
    return this._since;
  }

  public getMessage(): string | undefined {
    return this._message;
  }
}
