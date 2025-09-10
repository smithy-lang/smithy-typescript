import { sleep } from "./utils/sleep";
import type { WaiterOptions, WaiterResult } from "./waiter";
import { WaiterState } from "./waiter";

/**
 * @internal
 *
 * Reference: https://smithy.io/2.0/additional-specs/waiters.html#waiter-retries
 */
const exponentialBackoffWithJitter = (minDelay: number, maxDelay: number, attemptCeiling: number, attempt: number) => {
  if (attempt > attemptCeiling) return maxDelay;
  const delay = minDelay * 2 ** (attempt - 1);
  return randomInRange(minDelay, delay);
};

const randomInRange = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Function that runs polling as part of waiters. This will make one inital attempt and then
 * subsequent attempts with an increasing delay.
 * @param params - options passed to the waiter.
 * @param client - AWS SDK Client
 * @param input - client input
 * @param stateChecker - function that checks the acceptor states on each poll.
 */
export const runPolling = async <Client, Input>(
  { minDelay, maxDelay, maxWaitTime, abortController, client, abortSignal }: WaiterOptions<Client>,
  input: Input,
  acceptorChecks: (client: Client, input: Input) => Promise<WaiterResult>
): Promise<WaiterResult> => {
  const observedResponses: Record<string, number> = {};

  const { state, reason } = await acceptorChecks(client, input);
  if (reason) {
    const message = createMessageFromResponse(reason);
    observedResponses[message] |= 0;
    observedResponses[message] += 1;
  }

  if (state !== WaiterState.RETRY) {
    return { state, reason, observedResponses };
  }

  let currentAttempt = 1;
  const waitUntil = Date.now() + maxWaitTime * 1000;
  // The max attempt number that the derived delay time tend to increase.
  // Pre-compute this number to avoid Number type overflow.
  const attemptCeiling = Math.log(maxDelay / minDelay) / Math.log(2) + 1;
  while (true) {
    if (abortController?.signal?.aborted || abortSignal?.aborted) {
      const message = "AbortController signal aborted.";
      observedResponses[message] |= 0;
      observedResponses[message] += 1;
      return { state: WaiterState.ABORTED, observedResponses };
    }
    const delay = exponentialBackoffWithJitter(minDelay, maxDelay, attemptCeiling, currentAttempt);
    // Resolve the promise explicitly at timeout or aborted. Otherwise this while loop will keep making API call until
    // `acceptorCheck` returns non-retry status, even with the Promise.race() outside.
    if (Date.now() + delay * 1000 > waitUntil) {
      return { state: WaiterState.TIMEOUT, observedResponses };
    }
    await sleep(delay);
    const { state, reason } = await acceptorChecks(client, input);

    if (reason) {
      const message = createMessageFromResponse(reason);
      observedResponses[message] |= 0;
      observedResponses[message] += 1;
    }

    if (state !== WaiterState.RETRY) {
      return { state, reason, observedResponses };
    }

    currentAttempt += 1;
  }
};

/**
 * @internal
 * convert the result of an SDK operation, either an error or response object, to a
 * readable string.
 */
const createMessageFromResponse = (reason: any): string => {
  if (reason?.$responseBodyText) {
    // is a deserialization error.
    return `Deserialization error for body: ${reason.$responseBodyText}`;
  }
  if (reason?.$metadata?.httpStatusCode) {
    // has a status code.
    if (reason.$response || reason.message) {
      // is an error object.
      return `${reason.$response.statusCode ?? reason.$metadata.httpStatusCode ?? "Unknown"}: ${reason.message}`;
    }
    // is an output object.
    return `${reason.$metadata.httpStatusCode}: OK`;
  }
  // is an unknown object.
  return String(reason?.message ?? JSON.stringify(reason) ?? "Unknown");
};
