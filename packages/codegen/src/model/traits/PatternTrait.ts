import { ShapeId } from "../shapes/ShapeId";
import { StringTrait } from "./BaseTraits";

/**
 * @internal
 */
export class PatternTrait extends StringTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#pattern");

  constructor(value: unknown) {
    super(PatternTrait.ID, value);
  }
}
