import { MAXIMUM_RETRY_DELAY } from "../../util-retry/constants";

/**
 * Calculate a capped, fully-jittered exponential backoff time.
 * @internal
 * @deprecated replaced by \@smithy/util-retry (SRA).
 */
export const defaultDelayDecider = (delayBase: number, attempts: number) =>
  Math.floor(Math.min(MAXIMUM_RETRY_DELAY, Math.random() * 2 ** attempts * delayBase));
