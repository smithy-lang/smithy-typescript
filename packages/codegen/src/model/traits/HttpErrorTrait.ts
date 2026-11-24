import { Nodes } from "../node/Nodes";
import { ShapeId } from "../shapes/ShapeId";
import { Trait } from "./Trait";

/**
 * @internal
 */
export class HttpErrorTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#httpError");

  private readonly _code: number;

  constructor(value: unknown) {
    super(HttpErrorTrait.ID, value);
    this._code = Nodes.expectNumber(value);
  }

  public getCode(): number {
    return this._code;
  }
}
