/**
 * @internal
 *
 * Serializes a number, turning non-numeric values into strings.
 *
 * @param value - The number to serialize.
 * @returns A number, or a string if the given number was non-numeric.
 */
export const serializeFloat = (value: number): string | number => {
  // NaN is not equal to everything, including itself.
  if (value !== value) {
    return "NaN";
  }
  switch (value) {
    case Infinity:
      return "Infinity";
    case -Infinity:
      return "-Infinity";
    default:
      return value;
  }
};

/**
 * @internal
 * @param date - to be serialized.
 * @returns https://smithy.io/2.0/spec/protocol-traits.html#timestampformat-trait date-time format.
 */
export const serializeDateTime = (date: Date): string => date.toISOString().replace(".000Z", "Z");
