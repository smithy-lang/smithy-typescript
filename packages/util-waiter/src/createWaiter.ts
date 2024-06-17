import { AbortSignal as DeprecatedAbortSignal } from "@smithy/types";

import { runPolling } from "./poller";
import { validateWaiterOptions } from "./utils";
import { WaiterOptions, WaiterResult, waiterServiceDefaults, WaiterState } from "./waiter";

const abortTimeout = async (abortSignal: AbortSignal | DeprecatedAbortSignal): Promise<WaiterResult> => {
  return new Promise((resolve) => {
    const onAbort = () => resolve({ state: WaiterState.ABORTED });
    if (typeof (abortSignal as AbortSignal).addEventListener === "function") {
      (abortSignal as AbortSignal).addEventListener("abort", onAbort);
    } else {
      abortSignal.onabort = onAbort;
    }
  });
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
  if (options.abortController) {
    exitConditions.push(abortTimeout(options.abortController.signal));
  }

  if (options.abortSignal) {
    exitConditions.push(abortTimeout(options.abortSignal));
  }

  return Promise.race(exitConditions);
};
