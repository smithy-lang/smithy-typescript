import { getCircularReplacer } from "./circularReplacer";
import { sleep } from "./utils/sleep";
import type { WaiterOptions, WaiterResult } from "./waiter";
import { WaiterState } from "./waiter";

/**
 * Function that runs polling as part of waiters. This will make one inital attempt and then
 * subsequent attempts with an increasing delay.
 *
 * @param params - options passed to the waiter.
 * @param client - AWS SDK Client
 * @param input - client input
 * @param acceptorChecks - function that checks the acceptor states on each poll.
 */
export const runPolling = async <Client, Input, Reason = any>(
  { minDelay, maxDelay, maxWaitTime, abortController, client, abortSignal }: WaiterOptions<Client>,
  input: Input,
  acceptorChecks: (client: Client, input: Input) => Promise<WaiterResult<Reason>>
): Promise<WaiterResult<Reason>> => {
  const observedResponses: Record<string, number> = {};
  const [minDelayMs, maxDelayMs] = [minDelay * 1000, maxDelay * 1000];

  let currentAttempt = 0;
  const waitUntil = Date.now() + maxWaitTime * 1000;

  // warn about 403s if the waiter is still running at this time.
  const warn403Time = Date.now() + 60_000;
  let didWarn403 = false;

  while (true) {
    if (currentAttempt > 0) {
      const delayMs = exponentialBackoffWithJitter(minDelayMs, maxDelayMs, currentAttempt, waitUntil);

      if (abortController?.signal?.aborted || abortSignal?.aborted) {
        const message = "AbortController signal aborted.";
        observedResponses[message] |= 0;
        observedResponses[message] += 1;
        return { state: WaiterState.ABORTED, observedResponses };
      }
      if (Date.now() + delayMs > waitUntil) {
        return { state: WaiterState.TIMEOUT, observedResponses };
      }

      await sleep(delayMs / 1_000);
    }

    const { state, reason } = await acceptorChecks(client, input);

    if (reason) {
      const message = createMessageFromResponse(reason);
      observedResponses[message] |= 0;
      observedResponses[message] += 1;
    }

    if (state !== WaiterState.RETRY) {
      return { state, reason, final: reason, observedResponses };
    }

    currentAttempt += 1;

    if (!didWarn403 && Date.now() >= warn403Time) {
      checkWarn403(observedResponses, client);
      didWarn403 = true;
    }
  }
};

/**
 * Called after the waiter reaches at least 1 minute of wait time,
 * checking if the observed responses are predominantly 403s.
 *
 * In such a case, warn that 403 was encountered during waiter polling.
 */
const checkWarn403 = (observedResponses: Record<string, number> = {}, client: any): void => {
  const orderedErrors = Object.keys(observedResponses);

  let maxCount = 0;
  let count403 = 0;

  for (const response of orderedErrors) {
    const n = observedResponses[response] | 0;
    maxCount = Math.max(n, maxCount);
    if (response.startsWith("403:")) {
      count403 += n;
    }
  }
  const clientLogger = client?.config?.logger;
  const warningLogger =
    typeof clientLogger?.warn === "function" && !clientLogger.constructor?.name?.includes?.("NoOpLogger")
      ? clientLogger
      : console;

  if (count403 >= 3 || orderedErrors[orderedErrors.length - 1].startsWith("403:")) {
    warningLogger.warn(`@smithy/util-waiter WARN - 403 status code encountered during waiter polling.`);
  }
};

/**
 * Convert the result of an SDK operation, either an error or response object, to a
 * readable string.
 *
 * @internal
 */
const createMessageFromResponse = (reason: any): string => {
  const status = reason?.$response?.statusCode ?? reason?.$metadata?.httpStatusCode;

  if (reason?.$responseBodyText) {
    // is a deserialization error.
    return `${status ? status + ": " : ""}Deserialization error for body: ${reason.$responseBodyText}`;
  }
  if (status) {
    // has a status code.
    if (reason?.$response || reason?.message) {
      // is an error object.
      return `${status ?? "Unknown"}: ${reason?.message}`;
    }
    // is an output object.
    return `${status}: OK`;
  }
  // is an unknown object.
  return String(reason?.message ?? JSON.stringify(reason, getCircularReplacer()) ?? "Unknown");
};

/**
 * Reference: https://smithy.io/2.0/additional-specs/waiters.html#waiter-retries
 *
 * @internal
 */
const exponentialBackoffWithJitter = (minDelayMs: number, maxDelayMs: number, attempt: number, waitUntil: number) => {
  const attemptCountCeiling = Math.log(maxDelayMs / minDelayMs) / Math.log(2) + 1;
  if (attempt > attemptCountCeiling) {
    return maxDelayMs;
  }

  const delay = minDelayMs * 2 ** (attempt - 1);
  const capped = Math.min(delay, maxDelayMs);
  const waitFor = randomInRange(minDelayMs, capped);

  if (Date.now() + waitFor > waitUntil) {
    const timeRemaining = waitUntil - Date.now();
    // fire the last request 500ms before the waiter would time out.
    return Math.max(0, timeRemaining - 500);
  }
  return waitFor;
};

const randomInRange = (min: number, max: number) => min + Math.random() * (max - min);
