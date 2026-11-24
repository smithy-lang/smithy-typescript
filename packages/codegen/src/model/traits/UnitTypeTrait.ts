import { ShapeId } from "../shapes/ShapeId";
import { AnnotationTrait } from "./BaseTraits";

/**
 * @internal
 */
export class UnitTypeTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#unitType");
  public static readonly UNIT: ShapeId = ShapeId.from("smithy.api#Unit");

  constructor(value?: unknown) {
    super(UnitTypeTrait.ID, value);
  }
}
