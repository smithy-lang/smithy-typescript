/**
 * Evaluates arguments in order and returns the first non-empty result,
 * otherwise returns the result of the last argument.
 *
 * @internal
 */
export function coalesce<T>(...args: (T | undefined)[]): T | undefined {
  for (const arg of args) {
    if (arg != null) {
      return arg;
    }
  }
  return undefined;
}
