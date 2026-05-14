import type { Decoder, Encoder } from "@smithy/types";

/**
 * Adapter for conversions of the native Uint8Array type.
 * @public
 */
export interface IUint8ArrayBlobAdapter extends Uint8Array {
  /**
   * @param encoding - default 'utf-8'.
   * @returns the blob as string.
   */
  transformToString(encoding?: string): string;
}

export interface Uint8ArrayBlobAdapterConstructor {
  new (...args: any): IUint8ArrayBlobAdapter;
  fromString(source: string, encoding?: string): IUint8ArrayBlobAdapter;
  mutate(source: Uint8Array): IUint8ArrayBlobAdapter;
}

export function bindUint8ArrayBlobAdapter(
  toUtf8: Encoder,
  fromUtf8: Decoder,
  toBase64: Encoder,
  fromBase64: Decoder
): Uint8ArrayBlobAdapterConstructor {
  return class Uint8ArrayBlobAdapter extends Uint8Array {
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

    public transformToString(encoding = "utf-8"): string {
      if (encoding === "base64") {
        return toBase64(this);
      }
      return toUtf8(this);
    }
  };
}
