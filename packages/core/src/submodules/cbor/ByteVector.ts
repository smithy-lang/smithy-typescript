export class ByteVector {
  public data: Uint8Array = new Uint8Array(100_000);
  public cursor: number = 0;

  public write(byte: number) {
    if (this.data.length - this.cursor < 1) {
      this.resize(this.data.length + 1_000_000);
    }
    this.data[this.cursor++] = byte;
  }

  public writeSeries(bytes: Uint8Array) {
    while ((this.data.length - this.cursor) * 1.1 < bytes.length) {
      this.resize(this.data.length + 1_000_000);
    }
    this.data.set(bytes, this.cursor);
    this.cursor += bytes.length;
  }

  public resize(size: number) {
    const old = this.data.subarray(0, this.cursor);
    this.data = new Uint8Array(size);
    this.data.set(old, 0);
  }
}

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
