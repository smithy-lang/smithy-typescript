import { Nodes } from "../node/Nodes";
import { ShapeId } from "../shapes/ShapeId";
import { Trait } from "./Trait";

/**
 * @internal
 */
export class RequestCompressionTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#requestCompression");

  private readonly _encodings: string[];

  constructor(value: unknown) {
    super(RequestCompressionTrait.ID, value);
    this._encodings = Nodes.getStringArray(Nodes.expectObject(value), "encodings") ?? [];
  }

  public getEncodings(): string[] {
    return this._encodings;
  }
}
