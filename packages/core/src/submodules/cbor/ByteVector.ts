import { fromUtf8 } from "@smithy/util-utf8";

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
  private data: Uint8Array = new Uint8Array();
  private dataView: DataView = new DataView(this.data.buffer, 0, 0);
  private cursor: number = 0;
  private textEncoder: TextEncoder | null = USE_TEXT_ENCODER ? new TextEncoder() : null;

  public constructor(private initialSize: number = 1_000_000) {
    this.resize(initialSize);
  }

  public write(...bytes: number[]) {
    for (const byte of bytes) {
      if (this.cursor === this.data.length) {
        this.resize(this.cursor + this.initialSize);
      }
      this.data[this.cursor++] = byte;
    }
  }

  public writeBytes(bytes: Uint8Array) {
    if (this.cursor + bytes.length >= this.data.length) {
      this.resize(this.cursor + bytes.length + this.initialSize);
    }
    this.data.set(bytes, this.cursor);
    this.cursor += bytes.byteLength;
  }

  public writeUnsignedInt(major: number, bitSize: 16 | 32 | 64, value: number | bigint) {
    if (this.cursor + bitSize / 8 >= this.data.length) {
      this.resize(this.cursor + bitSize / 8 + this.initialSize);
    }
    const dv = byteVector.getDataView();
    switch (bitSize) {
      case 16:
        this.write(major);
        dv.setUint16(byteVector.getCursor(), Number(value) as number);
        this.cursor += 2;
        break;
      case 32:
        this.write(major);
        dv.setUint32(byteVector.getCursor(), Number(value) as number);
        this.cursor += 4;
        break;
      case 64:
        this.write(major);
        dv.setBigUint64(byteVector.getCursor(), BigInt(value) as bigint);
        this.cursor += 8;
        break;
    }
  }

  public writeFloat64(major: number, value: number) {
    if (this.cursor + 8 >= this.data.length) {
      this.resize(this.cursor + 8 + this.initialSize);
    }
    const dv = byteVector.getDataView();
    this.write(major);
    dv.setFloat64(this.cursor, value);
    this.cursor += 8;
  }

  public writeString(str: string) {
    if (this.cursor + str.length * 4 > this.data.length) {
      this.resize(this.cursor + str.length * 4 + this.initialSize);
    }
    if (USE_BUFFER && (this.data as BufferWithUtf8Write).utf8Write) {
      this.cursor += (this.data as BufferWithUtf8Write).utf8Write(str, this.cursor);
    } else if (USE_TEXT_ENCODER && this.textEncoder?.encodeInto) {
      this.cursor += this.textEncoder.encodeInto(str, this.data.subarray(this.cursor)).written;
    } else {
      const bytes = fromUtf8(str);
      this.writeBytes(bytes);
    }
  }

  public toUint8Array(): Uint8Array {
    const out = new Uint8Array(this.cursor);
    out.set(this.data.subarray(0, this.cursor), 0);
    this.cursor = 0;
    if (this.data.length > this.initialSize) {
      this.data = new Uint8Array(this.initialSize);
      this.dataView = new DataView(this.data.buffer, 0, this.initialSize);
    }
    return out;
  }

  public getDataView() {
    return this.dataView;
  }

  public getCursor() {
    return this.cursor;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private resize(size: number) {
    const data = this.data;
    this.data = USE_BUFFER ? Buffer.allocUnsafeSlow(size) : new Uint8Array(size);
    if (data) {
      this.data.set(data, 0);
    }
    this.dataView = new DataView(this.data.buffer, 0, size);
  }
}

export const byteVector = new ByteVector();
