import { AbortSignal as DeprecatedAbortSignal } from "@smithy/types";

import { runPolling } from "./poller";
import { validateWaiterOptions } from "./utils";
import { WaiterOptions, WaiterResult, waiterServiceDefaults, WaiterState } from "./waiter";

const abortTimeout = (
  abortSignal: AbortSignal | DeprecatedAbortSignal
): {
  clearListener: () => void;
  aborted: Promise<WaiterResult>;
} => {
  let onAbort: () => void;

  const promise = new Promise<WaiterResult>((resolve) => {
    onAbort = () => resolve({ state: WaiterState.ABORTED });
    if (typeof (abortSignal as AbortSignal).addEventListener === "function") {
      // preferred.
      (abortSignal as AbortSignal).addEventListener("abort", onAbort);
    } else {
      // backwards compatibility
      abortSignal.onabort = onAbort;
    }
  });

  return {
    clearListener() {
      if (typeof (abortSignal as AbortSignal).removeEventListener === "function") {
        (abortSignal as AbortSignal).removeEventListener("abort", onAbort);
      }
    },
    aborted: promise,
  };
};

/**
 * Create a waiter promise that only resolves when:
 * 1. Abort controller is signaled
 * 2. Max wait time is reached
 * 3. `acceptorChecks` succeeds, or fails
 * Otherwise, it invokes `acceptorChecks` with exponential-backoff delay.
 *
 * @internal
 */
export const createWaiter = async <Client, Input>(
  options: WaiterOptions<Client>,
  input: Input,
  acceptorChecks: (client: Client, input: Input) => Promise<WaiterResult>
): Promise<WaiterResult> => {
  const params = {
    ...waiterServiceDefaults,
    ...options,
  };
  validateWaiterOptions(params);

  const exitConditions = [runPolling<Client, Input>(params, input, acceptorChecks)];

  const finalize = [] as Array<() => void>;

  if (options.abortSignal) {
    const { aborted, clearListener } = abortTimeout(options.abortSignal);
    finalize.push(clearListener);
    exitConditions.push(aborted);
  }
  if (options.abortController?.signal) {
    const { aborted, clearListener } = abortTimeout(options.abortController.signal);
    finalize.push(clearListener);
    exitConditions.push(aborted);
  }

  return Promise.race<WaiterResult>(exitConditions).then((result) => {
    for (const fn of finalize) {
      fn();
    }
    return result;
  });
};
