import { fromArrayBuffer } from "@smithy/util-buffer-from";

export const toUtf8 = (input: Uint8Array): string =>
  fromArrayBuffer(input.buffer, input.byteOffset, input.byteLength).toString("utf8");
