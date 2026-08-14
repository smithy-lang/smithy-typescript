/**
 * @internal
 */
export function hasOwn(o: object, k: string) {
  return Object.prototype.hasOwnProperty.call(o, k);
}
