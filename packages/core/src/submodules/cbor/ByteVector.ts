export class ByteVector {
  private segments: Uint8Array[] = [];
  private cursor: number = 0;

  public constructor(private readonly segmentSize: number = 100_000) {
    this.alloc();
  }

  public writeSeries(data: Uint8Array) {
    for (let i = 0; i < data.length; i += this.segmentSize) {
      const part = data.subarray(i, Math.min(i + this.segmentSize, data.length));

      const remainder = this.segmentSize - this.cursor;
      if (remainder < part.length) {
        const [a, b] = [part.subarray(0, remainder), part.subarray(remainder, part.length)];
        this.getWriteBuffer().set(a, this.cursor);
        this.alloc().set(b, 0);
        this.cursor += b.length;
      } else {
        this.getWriteBuffer().set(part, this.cursor);
        this.cursor += part.length;
      }
    }
  }

  public write(...bytes: number[]) {
    let buffer = this.getWriteBuffer();
    for (const byte of bytes) {
      const remaining = this.segmentSize - this.cursor;
      if (remaining === 0) {
        buffer = this.alloc();
      }
      buffer[this.cursor++] = byte;
    }
  }

  public toUint8Array(): Uint8Array {
    this.segments[this.segments.length - 1] = this.getWriteBuffer().subarray(0, this.cursor);
    const joined = join(this.segments);
    this.segments = [];
    this.cursor = 0;
    return joined;
  }

  private getWriteBuffer() {
    return this.segments[this.segments.length - 1];
  }

  private alloc() {
    if (typeof Buffer !== "undefined") {
      this.segments.push(Buffer.allocUnsafe(this.segmentSize));
    } else {
      this.segments.push(new Uint8Array(this.segmentSize));
    }
    this.cursor = 0;
    return this.getWriteBuffer();
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
