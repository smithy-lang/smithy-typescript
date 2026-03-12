/**
 * Builds an abort error, using the AbortSignal's reason if available.
 *
 * @param abortSignal - Optional AbortSignal that may contain a reason.
 * @returns A new Error with name "AbortError". If the signal has a reason that's
 *          already an Error, the reason is set as `cause`. Otherwise creates a
 *          new Error with the reason as the message, or "Request aborted" if no
 *          reason.
 */
export function buildAbortError(abortSignal?: unknown): Error {
  const reason =
    abortSignal && typeof abortSignal === "object" && "reason" in abortSignal
      ? (abortSignal as { reason?: unknown }).reason
      : undefined;
  if (reason) {
    if (reason instanceof Error) {
      const abortError = new Error("Request aborted");
      abortError.name = "AbortError";
      (abortError as { cause?: unknown }).cause = reason;
      return abortError;
    }
    const abortError = new Error(String(reason));
    abortError.name = "AbortError";
    return abortError;
  }
  const abortError = new Error("Request aborted");
  abortError.name = "AbortError";
  return abortError;
}
