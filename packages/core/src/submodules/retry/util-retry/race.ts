import type { AbortSignal as DeprecatedAbortSignal } from "@smithy/types";

export const race = <T>(promise: Promise<T>, signal?: AbortSignal | DeprecatedAbortSignal): Promise<T> => {
  if (!signal) {
    return promise;
  }

  let cleanup = () => {};
  const aborted = new Promise<never>((_, reject) => {
    const handler = () => reject(createAbortError());

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

const createAbortError = () => Object.assign(new Error("Request aborted"), { name: "AbortError" });

export const isAbortError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
