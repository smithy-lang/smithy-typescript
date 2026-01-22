import type { WaiterConfiguration } from "@smithy/types";

import { getCircularReplacer } from "./circularReplacer";

export { WaiterConfiguration };

/**
 * @internal
 */
export const waiterServiceDefaults = {
  minDelay: 2,
  maxDelay: 120,
};

/**
 * @internal
 */
export type WaiterOptions<Client> = WaiterConfiguration<Client> &
  Required<Pick<WaiterConfiguration<Client>, "minDelay" | "maxDelay">>;

/**
 * @public
 */
export enum WaiterState {
  ABORTED = "ABORTED",
  FAILURE = "FAILURE",
  SUCCESS = "SUCCESS",
  RETRY = "RETRY",
  TIMEOUT = "TIMEOUT",
}

/**
 * @public
 */
export type WaiterResult<R = any> = {
  state: WaiterState;

  /**
   * (optional) Indicates a reason for why a waiter has reached its state.
   */
  reason?: R;

  /**
   * Responses observed by the waiter during its polling, where the value
   * is the count.
   */
  observedResponses?: Record<string, number>;
};

/**
 * Handles and throws exceptions resulting from the waiterResult
 * @internal
 * @param result - WaiterResult
 */
export const checkExceptions = <R>(result: WaiterResult<R>): WaiterResult<R> => {
  if (result.state === WaiterState.ABORTED) {
    const abortError = new Error(
      `${JSON.stringify(
        {
          ...result,
          reason: "Request was aborted",
        },
        getCircularReplacer()
      )}`
    );
    abortError.name = "AbortError";
    throw abortError;
  } else if (result.state === WaiterState.TIMEOUT) {
    const timeoutError = new Error(
      `${JSON.stringify(
        {
          ...result,
          reason: "Waiter has timed out",
        },
        getCircularReplacer()
      )}`
    );
    timeoutError.name = "TimeoutError";
    throw timeoutError;
  } else if (result.state !== WaiterState.SUCCESS) {
    throw new Error(`${JSON.stringify(result, getCircularReplacer())}`);
  }
  return result;
};
