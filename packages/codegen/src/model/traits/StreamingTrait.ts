import { ShapeId } from "../shapes/ShapeId";
import { AnnotationTrait } from "./BaseTraits";

/**
 * @internal
 */
export class StreamingTrait extends AnnotationTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#streaming");

  constructor(value?: unknown) {
    super(StreamingTrait.ID, value);
  }
}
