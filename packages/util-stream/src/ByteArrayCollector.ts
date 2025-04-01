/**
 * Aggregates byteArrays on demand.
 * @internal
 */
export class ByteArrayCollector {
  public byteLength = 0;
  private byteArrays = [] as Uint8Array[];

  public constructor(public readonly allocByteArray: (size: number) => Uint8Array) {}

  public push(byteArray: Uint8Array) {
    this.byteArrays.push(byteArray);
    this.byteLength += byteArray.byteLength;
  }

  public flush() {
    if (this.byteArrays.length === 1) {
      const bytes = this.byteArrays[0];
      this.reset();
      return bytes;
    }
    const aggregation = this.allocByteArray(this.byteLength);
    let cursor = 0;
    for (let i = 0; i < this.byteArrays.length; ++i) {
      const bytes = this.byteArrays[i];
      aggregation.set(bytes, cursor);
      cursor += bytes.byteLength;
    }
    this.reset();
    return aggregation;
  }

  private reset() {
    this.byteArrays = [];
    this.byteLength = 0;
  }
}
