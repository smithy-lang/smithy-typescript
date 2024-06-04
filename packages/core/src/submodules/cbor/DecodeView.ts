import { toUtf8 } from "@smithy/util-utf8";

import { alloc } from "./cbor-types";

const USE_TEXT_DECODER = typeof TextDecoder !== "undefined";

/**
 * Data container for synchronous decoding.
 */
export class DecodeView {
  public payload = alloc(0);
  public dataView = new DataView(this.payload.buffer, this.payload.byteOffset, this.payload.byteLength);
  private textDecoder = USE_TEXT_DECODER ? new TextDecoder() : null;

  public constructor(payload: Uint8Array) {
    this.set(payload);
  }

  public set(payload: Uint8Array) {
    this.payload = payload;
    this.dataView = new DataView(this.payload.buffer, this.payload.byteOffset, this.payload.byteLength);
  }

  public toUtf8(bytes: Uint8Array, at: number, to: number): string {
    if (this.textDecoder) {
      return this.textDecoder.decode(bytes.subarray(at, to));
    }
    return toUtf8(bytes.subarray(at, to));
  }
}

export const decodeView = new DecodeView(alloc(0));
