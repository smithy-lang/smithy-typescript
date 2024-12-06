/**
 * @internal
 * For test spies.
 */
export const timing = {
  setTimeout: (cb, timeout) => setTimeout(cb, timeout),
  clearTimeout: (id) => clearTimeout(id),
};
