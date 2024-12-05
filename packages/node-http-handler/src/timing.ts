/**
 * @internal
 * For test spies.
 */
export const timing = {
  setTimeout: setTimeout.bind(this),
  clearTimeout: clearTimeout.bind(this),
};
