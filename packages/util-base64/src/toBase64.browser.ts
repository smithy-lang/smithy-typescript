import { fromUtf8 } from "@smithy/util-utf8";

import { alphabetByValue, bitsPerByte, bitsPerLetter, maxLetterValue } from "./constants.browser";

/**
 * Converts a Uint8Array of binary data or a utf-8 string to a base-64 encoded string.
 *
 * @param _input - the binary data or string to encode.
 * @returns base64 string.
 *
 * @see https://tools.ietf.org/html/rfc4648#section-4
 */
export function toBase64(_input: Uint8Array | string): string {
  let input: Uint8Array;
  if (typeof _input === "string") {
    input = fromUtf8(_input);
  } else {
    input = _input as Uint8Array;
  }

  const isArrayLike = typeof input === "object" && typeof input.length === "number";
  const isUint8Array =
    typeof input === "object" &&
    typeof (input as Uint8Array).byteOffset === "number" &&
    typeof (input as Uint8Array).byteLength === "number";

  if (!isArrayLike && !isUint8Array) {
    throw new Error("@smithy/util-base64: toBase64 encoder function only accepts string | Uint8Array.");
  }

  let str = "";
  for (let i = 0; i < input.length; i += 3) {
    let bits = 0;
    let bitLength = 0;
    for (let j = i, limit = Math.min(i + 3, input.length); j < limit; j++) {
      bits |= input[j] << ((limit - j - 1) * bitsPerByte);
      bitLength += bitsPerByte;
    }

    const bitClusterCount = Math.ceil(bitLength / bitsPerLetter);
    bits <<= bitClusterCount * bitsPerLetter - bitLength;
    for (let k = 1; k <= bitClusterCount; k++) {
      const offset = (bitClusterCount - k) * bitsPerLetter;
      str += alphabetByValue[(bits & (maxLetterValue << offset)) >> offset];
    }

    str += "==".slice(0, 4 - bitClusterCount);
  }

  return str;
}
