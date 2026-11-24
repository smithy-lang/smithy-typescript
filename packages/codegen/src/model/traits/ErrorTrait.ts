import { SourceException } from "../exceptions/exceptions";
import { ShapeId } from "../shapes/ShapeId";
import { StringTrait } from "./BaseTraits";

/**
 * @internal
 */
export class ErrorTrait extends StringTrait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#error");

  constructor(value: unknown) {
    super(ErrorTrait.ID, value);
    if (!this.isClientError() && !this.isServerError()) {
      throw new SourceException("error trait must be set to client or server, found `" + this.getValue() + "`");
    }
  }

  public isClientError(): boolean {
    return this.getValue() === "client";
  }

  public isServerError(): boolean {
    return this.getValue() === "server";
  }
}
