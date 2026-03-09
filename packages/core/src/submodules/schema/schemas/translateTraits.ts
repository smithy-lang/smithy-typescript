import type { SchemaTraits, SchemaTraitsObject } from "@smithy/types";

/**
 * Module-level cache for translateTraits() numeric bitmask inputs.
 * Only ~128 possible bitmask values exist, so a fixed-size Map is fine.
 */
const traitsCache = new Map<number, SchemaTraitsObject>();

/**
 * @internal
 * @param indicator - numeric indicator for preset trait combination.
 * @returns equivalent trait object.
 */
export function translateTraits(indicator: SchemaTraits): SchemaTraitsObject {
  if (typeof indicator === "object") {
    return indicator;
  }
  indicator = indicator | 0;

  const cached = traitsCache.get(indicator);
  if (cached !== undefined) {
    return cached;
  }

  const traits = {} as SchemaTraitsObject;
  let i = 0;
  for (const trait of [
    "httpLabel",
    "idempotent",
    "idempotencyToken",
    "sensitive",
    "httpPayload",
    "httpResponseCode",
    "httpQueryParams",
  ] as Array<keyof SchemaTraitsObject>) {
    if (((indicator >> i++) & 1) === 1) {
      traits[trait] = 1;
    }
  }

  Object.freeze(traits);
  traitsCache.set(indicator, traits);
  return traits;
}
