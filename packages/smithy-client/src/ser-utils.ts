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
 * @param date - to be serialized.
 * @returns https://smithy.io/1.0/spec/core/protocol-traits.html#timestampformat-trait date-time format.
 */
export const serializeDateTime = (date: Date): string => {
  const iso = date.toISOString();
  const [prefix, milliseconds] = iso.split(".");
  if (milliseconds === "000Z") {
    return prefix + "Z";
  }
  return iso;
};
