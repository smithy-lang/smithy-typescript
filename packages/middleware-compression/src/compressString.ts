import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { toUint8Array } from "@smithy/core/serde";

const gzipAsync = promisify(gzip);

export const compressString = async (body: any): Promise<Uint8Array> => {
  // Only gzip shall be supported initial release.
  try {
    const compressedBuffer = await gzipAsync(toUint8Array(body || ""));
    return toUint8Array(compressedBuffer);
  } catch (err) {
    throw new Error("Failure during compression: " + err.message);
  }
};
