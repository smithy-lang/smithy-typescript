import { ShapeId } from "../shapes/ShapeId";
import { Trait } from "./Trait";

export class DefaultTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#default");

  constructor(value: unknown) {
    super(DefaultTrait.ID, value === undefined ? null : value);
  }
}
