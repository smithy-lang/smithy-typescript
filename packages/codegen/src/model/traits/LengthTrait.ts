import { Nodes } from "../node/Nodes";
import { ShapeId } from "../shapes/ShapeId";
import { Trait } from "./Trait";

/**
 * @internal
 */
export class LengthTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#length");

  private readonly _min: number | undefined;
  private readonly _max: number | undefined;

  constructor(value: unknown) {
    super(LengthTrait.ID, value);
    const object = Nodes.expectObject(value);
    this._min = Nodes.getNumber(object, "min");
    this._max = Nodes.getNumber(object, "max");
  }

  public getMin(): number | undefined {
    return this._min;
  }

  public getMax(): number | undefined {
    return this._max;
  }
}
