import type { SchemaTraits, SchemaTraitsObject } from "@smithy/types";

/**
 * Module-level cache for translateTraits() numeric bitmask inputs.
 *
 * @internal
 */
export const traitsCache: SchemaTraitsObject[] = [];

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

  if (traitsCache[indicator]) {
    return traitsCache[indicator];
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

  return (traitsCache[indicator] = traits);
}
