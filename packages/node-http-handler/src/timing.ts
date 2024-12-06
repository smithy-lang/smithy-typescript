/**
 * @internal
 * For test spies.
 */
export const timing = {
  setTimeout: (cb: (...ignored: any[]) => void | unknown, ms?: number) => setTimeout(cb, ms),
  clearTimeout: (timeoutId: string | number | undefined | unknown) =>
    clearTimeout(timeoutId as Parameters<typeof clearTimeout>[0]),
};
