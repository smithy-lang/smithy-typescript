/**
 * An if-then-else function that returns one of two values based on a boolean condition.
 *
 * @internal
 */
export function ite<T>(condition: boolean, trueValue: T | undefined, falseValue: T | undefined): T | undefined {
  return condition ? trueValue : falseValue;
}
