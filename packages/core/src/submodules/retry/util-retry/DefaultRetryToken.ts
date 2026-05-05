import type { StandardRetryToken } from "@smithy/types";

import { MAXIMUM_RETRY_DELAY } from "./constants";

/**
 * @internal
 */
export class DefaultRetryToken implements StandardRetryToken {
  public constructor(
    private readonly delay: number,
    private readonly count: number,
    private readonly cost: number | undefined,
    private readonly longPoll: boolean
  ) {}

  public getRetryCount(): number {
    return this.count;
  }

  public getRetryDelay(): number {
    return Math.min(MAXIMUM_RETRY_DELAY, this.delay);
  }

  public getRetryCost(): number | undefined {
    return this.cost;
  }

  public isLongPoll(): boolean {
    return this.longPoll;
  }
}
