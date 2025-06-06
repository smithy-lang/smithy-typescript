/**
 * Prints bytes as binary string with numbers.
 * @param bytes
 */
export function printBytes(bytes: Uint8Array) {
  return [...bytes].map((n) => ("0".repeat(8) + n.toString(2)).slice(-8) + ` (${n})`);
}
