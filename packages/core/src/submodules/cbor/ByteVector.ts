import { fromUtf8 } from "@smithy/util-utf8";

import { alloc, Uint8 } from "./cbor-types";

const USE_BUFFER = typeof Buffer !== "undefined";
const USE_TEXT_ENCODER = typeof TextEncoder !== "undefined";

type BufferWithUtf8Write = Buffer & {
  utf8Write(str: string, index: number): number;
};

/**
 *
 * Data container for synchronous encoding.
 *
 */
export class ByteVector {
  private data: Uint8Array = alloc(0);
  private dataView: DataView = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
  private cursor: number = 0;
  private textEncoder: TextEncoder | null = USE_TEXT_ENCODER ? new TextEncoder() : null;

  public constructor(private initialSize: number = 1_000_000) {
    this.resize(initialSize);
  }

  public write(byte: Uint8) {
    this.data[this.cursor++] = byte;
  }

  public writeBytes(bytes: Uint8Array) {
    this.data.set(bytes, this.cursor);
    this.cursor += bytes.byteLength;
  }

  public writeUint16(major: number, value: number) {
    this.data[this.cursor++] = major;
    this.data[this.cursor++] = value >> 8;
    this.data[this.cursor++] = value & 0b1111_1111;
  }

  public writeUint32(major: number, value: number) {
    this.data[this.cursor++] = major;
    this.dataView.setUint32(this.cursor, value as number);
    this.cursor += 4;
  }

  public writeUint64(major: number, value: number | bigint) {
    this.data[this.cursor++] = major;
    this.dataView.setBigUint64(this.cursor, typeof value === "bigint" ? value : BigInt(value));
    this.cursor += 8;
  }

  public writeFloat64(major: number, value: number) {
    this.data[this.cursor++] = major;
    this.dataView.setFloat64(this.cursor, value);
    this.cursor += 8;
  }

  public writeString(str: string) {
    if (USE_BUFFER && (this.data as BufferWithUtf8Write).utf8Write) {
      this.cursor += (this.data as BufferWithUtf8Write).utf8Write(str, this.cursor);
    } else if (USE_TEXT_ENCODER && this.textEncoder?.encodeInto) {
      this.cursor += this.textEncoder.encodeInto(str, this.data.subarray(this.cursor)).written;
    } else {
      const bytes = fromUtf8(str);
      this.writeBytes(bytes);
    }
  }

  public ensureSpace(bytes: number) {
    if (this.data.byteLength - this.cursor < bytes) {
      this.resize(this.data.byteLength + this.initialSize + bytes);
    }
  }

  public toUint8Array(): Uint8Array {
    const out = alloc(this.cursor);
    out.set(this.data.subarray(0, this.cursor), 0);
    this.cursor = 0;
    if (this.data.length > this.initialSize) {
      this.data = alloc(this.initialSize);
      this.dataView = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
    }
    return out;
  }

  private resize(size: number) {
    const data = this.data;
    this.data = alloc(size);
    if (data) {
      this.data.set(data, 0);
    }
    this.dataView = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
  }
}

export const byteVector = new ByteVector(10_000_000);
