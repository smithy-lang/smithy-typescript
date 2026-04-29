import { fromBase64, toBase64 } from "@smithy/util-base64";
import { fromUtf8, toUtf8 } from "@smithy/util-utf8";

/**
 * Adapter for conversions of the native Uint8Array type.
 * @public
 */
export class Uint8ArrayBlobAdapter extends Uint8Array {
  /**
   * @param source - such as a string or Stream.
   * @param encoding - utf-8 or base64.
   * @returns a new Uint8ArrayBlobAdapter extending Uint8Array.
   */
  public static fromString(source: string, encoding = "utf-8"): Uint8ArrayBlobAdapter {
    if (typeof source === "string") {
      if (encoding === "base64") {
        return Uint8ArrayBlobAdapter.mutate(fromBase64(source));
      }
      return Uint8ArrayBlobAdapter.mutate(fromUtf8(source));
    }
    throw new Error(`Unsupported conversion from ${typeof source} to Uint8ArrayBlobAdapter.`);
  }

  /**
   * @param source - Uint8Array to be mutated.
   * @returns the same Uint8Array but with prototype switched to Uint8ArrayBlobAdapter.
   */
  public static mutate(source: Uint8Array): Uint8ArrayBlobAdapter {
    Object.setPrototypeOf(source, Uint8ArrayBlobAdapter.prototype);
    return source as Uint8ArrayBlobAdapter;
  }

  /**
   * @param encoding - default 'utf-8'.
   * @returns the blob as string.
   */
  public transformToString(encoding = "utf-8"): string {
    if (encoding === "base64") {
      return toBase64(this);
    }
    return toUtf8(this);
  }
}
