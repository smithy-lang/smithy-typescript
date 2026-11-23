import type { AbortSignal as DeprecatedAbortSignal } from "@smithy/types";

export const race = <T>(promise: Promise<T>, signal?: AbortSignal | DeprecatedAbortSignal): Promise<T> => {
  if (!signal) {
    return promise;
  }

  let cleanup = () => {};
  const aborted = new Promise<never>((_, reject) => {
    const handler = () => reject(createAbortError(signal));

    if (signal.aborted) {
      handler();
    } else if (typeof (signal as AbortSignal).addEventListener === "function") {
      (signal as AbortSignal).addEventListener("abort", handler, { once: true });
      cleanup = () => (signal as AbortSignal).removeEventListener("abort", handler);
    } else {
      signal.onabort = handler;
    }
  });

  return Promise.race([promise, aborted]).finally(cleanup);
};

/**
 * Matches the abort errors thrown by the HTTP handlers: an Error reason is kept as the
 * `cause`, and any other reason becomes the message.
 */
const createAbortError = (signal: AbortSignal | DeprecatedAbortSignal): Error => {
  const reason = (signal as { reason?: unknown }).reason;
  if (reason instanceof Error) {
    return Object.assign(new Error("Request aborted"), { name: "AbortError", cause: reason });
  }
  return Object.assign(new Error(reason ? String(reason) : "Request aborted"), { name: "AbortError" });
};

export const isAbortError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
