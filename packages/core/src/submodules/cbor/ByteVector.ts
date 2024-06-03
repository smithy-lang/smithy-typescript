import { CborMajorType } from "./cbor";

export class ByteVector {
  private data: Uint8Array = new Uint8Array();
  private dataView: DataView = new DataView(this.data.buffer, 0, 0);
  private cursor: number = 0;

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

  public writeSeries(bytes: Uint8Array) {
    if (this.cursor + bytes.length >= this.data.length) {
      this.resize(this.cursor + bytes.length + this.initialSize);
    }
    this.data.set(bytes, this.cursor);
    this.cursor += bytes.byteLength;
  }

  public writeUnsignedInt(major: CborMajorType, bitSize: 16 | 32 | 64, value: number | bigint) {
    if (this.cursor + bitSize / 8 >= this.data.length) {
      this.resize(this.cursor + bitSize / 8 + this.initialSize);
    }
    const dv = byteVector.getDataView();
    switch (bitSize) {
      case 16:
        this.write((major << 5) | 25);
        dv.setUint16(byteVector.getCursor(), Number(value) as number);
        this.cursor += 2;
        break;
      case 32:
        this.write((major << 5) | 26);
        dv.setUint32(byteVector.getCursor(), Number(value) as number);
        this.cursor += 4;
        break;
      case 64:
        this.write((major << 5) | 27);
        dv.setBigUint64(byteVector.getCursor(), BigInt(value) as bigint);
        this.cursor += 8;
        break;
    }
  }

  public toUint8Array(): Uint8Array {
    const out = new Uint8Array(this.cursor);
    out.set(this.data.slice(0, this.cursor), 0);
    this.data = new Uint8Array(this.initialSize);
    this.cursor = 0;
    this.dataView = new DataView(this.data.buffer, 0, this.initialSize);
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
    this.data = typeof Buffer !== "undefined" ? new Uint8Array(size) : new Uint8Array(size);
    if (data) {
      this.data.set(data, 0);
    }
    this.dataView = new DataView(this.data.buffer, 0, size);
  }
}

export const byteVector = new ByteVector();

export function join(byteArrays: Uint8Array[]): Uint8Array {
  let length = 0;
  for (const arr of byteArrays) {
    length += arr.length;
  }
  let offset = 0;
  const joined = new Uint8Array(length);
  for (const arr of byteArrays) {
    joined.set(arr, offset);
    offset += arr.length;
  }
  return joined;
}
