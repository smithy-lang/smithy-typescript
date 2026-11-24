import { ShapeId } from "../shapes/ShapeId";
import { StringTrait } from "./BaseTraits";

type TimestampFormat = "epoch-seconds" | "date-time" | "http-date" | "unknown";

/**
 * @internal
 */
export class TimestampFormatTrait extends StringTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#timestampFormat");

  private readonly _format: TimestampFormat;

  constructor(value: unknown) {
    super(TimestampFormatTrait.ID, value);
    const text = this.getValue();
    this._format =
      text === "epoch-seconds" || text === "date-time" || text === "http-date" ? (text as TimestampFormat) : "unknown";
  }
}
