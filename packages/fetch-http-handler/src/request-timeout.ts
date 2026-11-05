/**
 * Rejects with a TimeoutError after `timeoutInMs` (never, for 0).
 *
 * Call `cancel` once the request settles: a pending timer keeps the request
 * race, and the response it settled with, reachable until the timer fires.
 *
 * @internal
 */
export function requestTimeout(timeoutInMs = 0): { promise: Promise<never>; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<never>((resolve, reject) => {
    if (timeoutInMs) {
      timeoutId = setTimeout(() => {
        const timeoutError = new Error(`Request did not complete within ${timeoutInMs} ms`);
        timeoutError.name = "TimeoutError";
        reject(timeoutError);
      }, timeoutInMs);
    }
  });
  return { promise, cancel: () => clearTimeout(timeoutId) };
}
