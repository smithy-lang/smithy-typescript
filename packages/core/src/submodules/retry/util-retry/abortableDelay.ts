import type { AbortSignal as DeprecatedAbortSignal } from "@smithy/types";

type SetTimeoutFn = (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;

const defaultSetTimeout: SetTimeoutFn = (callback, delay) => setTimeout(callback, delay);

export const abortableDelay = (
  delay: number,
  abortSignal?: AbortSignal | DeprecatedAbortSignal,
  setTimeoutFn: SetTimeoutFn = defaultSetTimeout
): Promise<void> => {
  if (!abortSignal) {
    return new Promise((resolve) => setTimeoutFn(resolve, delay));
  }

  if (abortSignal.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const eventTargetSignal = abortSignal as AbortSignal;
    const previousOnAbort = abortSignal.onabort;
    const previousOnAbortFn = typeof previousOnAbort === "function" ? (previousOnAbort as Function) : undefined;

    const cleanup = () => {
      if (typeof eventTargetSignal.removeEventListener === "function") {
        eventTargetSignal.removeEventListener("abort", onAbort);
      } else if (abortSignal.onabort === onDeprecatedAbort) {
        abortSignal.onabort = previousOnAbort;
      }
    };
    const onAbort = () => {
      clearTimeout(timeoutId);
      cleanup();
      reject(createAbortError());
    };
    const onDeprecatedAbort = () => {
      previousOnAbortFn?.call(abortSignal, undefined);
      onAbort();
    };

    if (typeof eventTargetSignal.addEventListener === "function") {
      eventTargetSignal.addEventListener("abort", onAbort, { once: true });
    } else {
      abortSignal.onabort = onDeprecatedAbort;
    }

    timeoutId = setTimeoutFn(() => {
      cleanup();
      resolve();
    }, delay);
  });
};

const createAbortError = () => Object.assign(new Error("Request aborted"), { name: "AbortError" });
