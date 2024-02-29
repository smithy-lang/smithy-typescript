import { fromArrayBuffer } from "@smithy/util-buffer-from";
import { fromUtf8 } from "@smithy/util-utf8";

/**
 * Converts a Uint8Array of binary data or a utf-8 string to a base-64 encoded string using
 * Node.JS's `buffer` module.
 *
 * @param _input - the binary data or string to encode.
 * @returns base64 string.
 */
export const toBase64 = (_input: Uint8Array | string): string => {
  let input: Uint8Array;
  if (typeof _input === "string") {
    input = fromUtf8(_input);
  } else {
    input = _input as Uint8Array;
  }
  return fromArrayBuffer(input.buffer, input.byteOffset, input.byteLength).toString("base64");
};
