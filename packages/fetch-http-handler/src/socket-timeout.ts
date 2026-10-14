/**
 * Rolling inactivity timer for the fetch handler, the fetch-side analog of the
 * Node socket timeout. Armed at dispatch (covers the wait before the first byte)
 * and reset on each downloaded chunk; fires via an AbortController. Download
 * direction only, and the per-chunk reset applies only where `response.body`
 * streams (not stock React Native).
 *
 * @internal
 */
export interface SocketTimeoutMonitor {
  /** AbortController whose signal is passed into fetch; aborted on inactivity. */
  readonly controller: AbortController;
  /** Rejects with a TimeoutError when the inactivity window elapses; never resolves. */
  readonly timeoutPromise: Promise<never>;
  /** Restart the window on activity outside the body stream, such as response headers arriving. */
  reset(): void;
  /** Wrap a download stream so each chunk resets the window. Only call it when a stream exists. */
  monitor<T extends ReadableStream>(body: T): T;
  /** Clear the timer once the response is settled, so it cannot abort late. */
  clear(): void;
  /** Run a callback once when the monitor settles, by clear() or by the timer firing. */
  onSettled(listener: () => void): void;
}

/**
 * Create a dispatch-armed rolling inactivity monitor. A non-positive
 * `timeoutInMs` disables it: no timer, `monitor` returns the stream unchanged,
 * and `timeoutPromise` never settles.
 *
 * @internal
 */
export const createSocketTimeoutMonitor = (timeoutInMs: number): SocketTimeoutMonitor => {
  const controller = new AbortController();

  if (!(timeoutInMs > 0)) {
    return {
      controller,
      timeoutPromise: new Promise<never>(() => {}),
      reset: () => {},
      monitor: (body) => body,
      clear: () => {},
      onSettled: () => {},
    };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectTimeout: ((err: Error) => void) | undefined;
  let settled = false;
  const settledListeners: Array<() => void> = [];

  const settle = () => {
    settled = true;
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    for (const listener of settledListeners.splice(0)) {
      listener();
    }
  };

  const fire = () => {
    if (settled) {
      return;
    }
    const error = new Error(
      `@smithy/fetch-http-handler - the request received no data for ${timeoutInMs} ms (inactivity timeout).`
    );
    error.name = "TimeoutError";
    try {
      controller.abort(error);
    } catch {
      // Some runtimes' AbortController.abort takes no reason.
      controller.abort();
    }
    rejectTimeout?.(error);
    settle();
  };

  const arm = () => {
    if (settled) {
      return;
    }
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(fire, timeoutInMs);
  };

  // Stops the window while no read is pending, so time the consumer spends not reading
  // (backpressure) is not counted as network inactivity.
  const disarm = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const clear = () => {
    if (!settled) {
      settle();
    }
  };

  const onSettled = (listener: () => void) => {
    if (settled) {
      listener();
    } else {
      settledListeners.push(listener);
    }
  };

  arm();

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    rejectTimeout = reject;
  });

  const monitor = (<T extends ReadableStream>(body: T): T => {
    const reader = (body as ReadableStream<Uint8Array>).getReader();
    const monitored = new ReadableStream<Uint8Array>({
      async pull(streamController) {
        try {
          // The window runs only while this read is waiting on the network.
          arm();
          const { done, value } = await reader.read();
          if (done) {
            clear();
            streamController.close();
            return;
          }
          disarm();
          streamController.enqueue(value);
        } catch (e) {
          clear();
          streamController.error(e as Error);
        }
      },
      cancel(reason) {
        clear();
        return reader.cancel(reason);
      },
    });
    return monitored as unknown as T;
  }) as <T extends ReadableStream>(body: T) => T;

  return { controller, timeoutPromise, reset: arm, monitor, clear, onSettled };
};
