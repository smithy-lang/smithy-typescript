import type { AbortSignal as DeprecatedAbortSignal } from "@smithy/types";

type SetTimeoutFn = (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;

const defaultSetTimeout: SetTimeoutFn = (callback, delay) => setTimeout(callback, delay);

export const abortablePromise = <T>(
  promise: Promise<T>,
  abortSignal?: AbortSignal | DeprecatedAbortSignal,
  onAbort?: () => void
): Promise<T> => {
  if (!abortSignal) {
    return promise;
  }

  if (abortSignal.aborted) {
    onAbort?.();
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let cleanup = () => {};
    const eventTargetSignal = abortSignal as AbortSignal;
    const previousOnAbort = abortSignal.onabort;
    const previousOnAbortFn = typeof previousOnAbort === "function" ? (previousOnAbort as Function) : undefined;

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };
    const handleAbort = () =>
      settle(() => {
        onAbort?.();
        reject(createAbortError());
      });
    const handleDeprecatedAbort = () => {
      try {
        previousOnAbortFn?.call(abortSignal, undefined);
      } finally {
        handleAbort();
      }
    };

    if (typeof eventTargetSignal.addEventListener === "function") {
      eventTargetSignal.addEventListener("abort", handleAbort, { once: true });
      cleanup = () => eventTargetSignal.removeEventListener("abort", handleAbort);
    } else {
      abortSignal.onabort = handleDeprecatedAbort;
      cleanup = () => {
        if (abortSignal.onabort === handleDeprecatedAbort) {
          abortSignal.onabort = previousOnAbort;
        }
      };
    }

    if (abortSignal.aborted) {
      handleAbort();
      return;
    }

    promise.then(
      (value) => settle(() => resolve(value)),
      (error) => settle(() => reject(error))
    );
  });
};

export const abortableDelay = (
  delay: number,
  abortSignal?: AbortSignal | DeprecatedAbortSignal,
  setTimeoutFn: SetTimeoutFn = defaultSetTimeout
): Promise<void> => {
  let timeoutId: ReturnType<typeof setTimeout>;
  const delayPromise = new Promise<void>((resolve) => {
    timeoutId = setTimeoutFn(resolve, delay);
  });
  return abortablePromise(delayPromise, abortSignal, () => clearTimeout(timeoutId));
};

const createAbortError = () => Object.assign(new Error("Request aborted"), { name: "AbortError" });

export const isAbortError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
