import { fromArrayBuffer } from "../util-buffer-from/buffer-from";

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
  // TODO(TS6): type input as Uint8Array<ArrayBuffer> to remove cast
  // after dropping support for TS < 5.7.
  return fromArrayBuffer(input.buffer as ArrayBuffer, input.byteOffset, input.byteLength).toString("utf8");
};
