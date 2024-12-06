/**
 * @internal
 * For test spies.
 */
export const timing = {
  setTimeout: (cb: () => void, ms?: number) => setTimeout(cb, ms),
  clearTimeout: (timeoutId: NodeJS.Timeout | string | number | undefined) => clearTimeout(timeoutId),
};
