/**
 * Attempts to extract the name of the variable that the functional selector is looking for.
 * Improves readability over the raw Function.toString() value.
 *
 * @param functionString - function's string representation.
 *
 * @returns constant value used within the function.
 */
export function getSelectorName(functionString: string): string {
  const constants = new Set(Array.from(functionString.match(/([A-Z_]){3,}/g) ?? []));
  constants.delete("CONFIG");
  constants.delete("CONFIG_PREFIX_SEPARATOR");
  constants.delete("ENV");
  return [...constants].join(", ");
}
