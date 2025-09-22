import { randomUUID } from "./randomUUID";

const decimalToHex = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));

/**
 * Generates a RFC4122 version 4 UUID
 *
 * This function generates a random UUID using one of two methods:
 * 1. The native randomUUID() function if available
 * 2. A fallback implementation using crypto.getRandomValues()
 *
 * The fallback implementation:
 * - Generates 16 random bytes using crypto.getRandomValues()
 * - Sets the version bits to indicate version 4
 * - Sets the variant bits to indicate RFC4122
 * - Formats the bytes as a UUID string with dashes
 *
 * @returns A version 4 UUID string in the format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * where x is any hexadecimal digit and y is one of 8, 9, a, or b.
 *
 * @internal
 */
export const v4 = () => {
  if (randomUUID) {
    return randomUUID();
  }

  const rnds = new Uint8Array(16);
  crypto.getRandomValues(rnds);

  // Set version (4) and variant (RFC4122)
  rnds[6] = (rnds[6] & 0x0f) | 0x40; // version 4
  rnds[8] = (rnds[8] & 0x3f) | 0x80; // variant

  return (
    decimalToHex[rnds[0]] +
    decimalToHex[rnds[1]] +
    decimalToHex[rnds[2]] +
    decimalToHex[rnds[3]] +
    "-" +
    decimalToHex[rnds[4]] +
    decimalToHex[rnds[5]] +
    "-" +
    decimalToHex[rnds[6]] +
    decimalToHex[rnds[7]] +
    "-" +
    decimalToHex[rnds[8]] +
    decimalToHex[rnds[9]] +
    "-" +
    decimalToHex[rnds[10]] +
    decimalToHex[rnds[11]] +
    decimalToHex[rnds[12]] +
    decimalToHex[rnds[13]] +
    decimalToHex[rnds[14]] +
    decimalToHex[rnds[15]]
  );
};
