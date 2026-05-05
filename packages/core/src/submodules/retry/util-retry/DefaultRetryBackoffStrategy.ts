import type { StandardRetryBackoffStrategy } from "@smithy/types";

import { MAXIMUM_RETRY_DELAY } from "./constants";
import { Retry } from "./retries-2026-config";

/**
 * @internal
 */
export class DefaultRetryBackoffStrategy implements StandardRetryBackoffStrategy {
  protected x: number = Retry.delay();

  /**
   * @param i - attempt count starting from zero.
   */
  public computeNextBackoffDelay(i: number): number {
    // These values are named after the variables present in the spec
    // for easier cross-checking.
    const b = Math.random();
    const r = 2;
    const t_i = b * Math.min(this.x * r ** i, MAXIMUM_RETRY_DELAY);
    return Math.floor(t_i);
  }

  public setDelayBase(delay: number): void {
    this.x = delay;
  }
}
