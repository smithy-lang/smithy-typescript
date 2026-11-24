import { Nodes } from "../node/Nodes";
import { ShapeId } from "../shapes/ShapeId";
import { Trait } from "./Trait";

/**
 * @internal
 */
export class RetryableTrait extends Trait {
  public static readonly ID: ShapeId = ShapeId.from("smithy.api#retryable");

  private readonly _throttling: boolean;

  constructor(value?: unknown) {
    super(RetryableTrait.ID, value === undefined || value === null ? {} : value);
    this._throttling = Nodes.getBooleanOrDefault(Nodes.expectObject(this.toNode()), "throttling");
  }

  public getThrottling(): boolean {
    return this._throttling;
  }
}
