import { fromArrayBuffer } from "@smithy/util-buffer-from";

/**
 *
 * This does not convert non-utf8 strings to utf8, it only passes through strings if
 * a string is received instead of a Uint8Array.
 *
 */
export const toUtf8 = (input: Uint8Array | string): string => {
  if (typeof input === "string") {
    return input;
  }
  if (typeof input !== "object" || typeof input.byteOffset !== "number" || typeof input.byteLength !== "number") {
    throw new Error("@smithy/util-utf8: toUtf8 encoder function only accepts string | Uint8Array.");
  }
  return fromArrayBuffer(input.buffer, input.byteOffset, input.byteLength).toString("utf8");
};
