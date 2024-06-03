import { toUtf8 } from "@smithy/util-utf8";

const USE_TEXT_DECODER = typeof TextDecoder !== "undefined";

/**
 * Data container for synchronous decoding.
 */
export class DecodeView {
  public payload = new Uint8Array();
  public dataView = new DataView(this.payload.buffer, 0, this.payload.length);
  private textDecoder = USE_TEXT_DECODER ? new TextDecoder() : null;

  public constructor(payload: Uint8Array) {
    this.set(payload);
  }

  public set(payload: Uint8Array) {
    this.payload = payload;
    this.dataView = new DataView(this.payload.buffer, 0, this.payload.length);
  }

  public toUtf8(bytes: Uint8Array, at: number, to: number): string {
    if (this.textDecoder) {
      return this.textDecoder.decode(bytes.subarray(at, to));
    }
    return toUtf8(bytes.subarray(at, to));
  }
}

export const decodeView = new DecodeView(new Uint8Array());
