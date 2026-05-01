import type { SelectorType } from "./types";

/**
 * Returns number value for string value, if the string is defined in obj[key].
 * Returns undefined, if obj[key] is not defined.
 * Throws error for all other cases.
 *
 * @internal
 */
export const numberSelector = (obj: Record<string, string | undefined>, key: string, type: SelectorType) => {
  if (!(key in obj)) return undefined;

  const numberValue = parseInt(obj[key] as string, 10);
  if (Number.isNaN(numberValue)) {
    throw new TypeError(`Cannot load ${type} '${key}'. Expected number, got '${obj[key]}'.`);
  }

  return numberValue;
};
