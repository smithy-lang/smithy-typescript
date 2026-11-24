import { ShapeId } from "../shapes/ShapeId";
import { StringListTrait } from "./BaseTraits";

export class TagsTrait extends StringListTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#tags");

  constructor(value: unknown) {
    super(TagsTrait.ID, value);
  }
}
