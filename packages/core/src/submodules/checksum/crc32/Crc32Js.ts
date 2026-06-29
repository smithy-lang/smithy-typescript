import type { Checksum } from "@smithy/types";

// CRC-32 lookup table (IEEE polynomial 0xEDB88320).
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; ++i) {
  let c = i;
  for (let j = 0; j < 8; ++j) {
    c = c & 1 ? 0xedb88320 /* 0b1110_1101_1011_1000_1000_0011_0010_0000 */ ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

const ONES = 0xffff_ffff; /* 0b1111_1111_1111_1111_1111_1111_1111_1111 */

/**
 * Pure JS CRC-32 implementation using the IEEE 802.3 polynomial.
 * @see https://www.w3.org/TR/png/#D-CRCAppendix
 * @public
 */
export class Crc32Js implements Checksum {
  public readonly digestLength = 4;
  private checksum = ONES;

  public update(data: Uint8Array): void {
    for (let i = 0; i < data.length; ++i) {
      this.checksum = (this.checksum >>> 8) ^ CRC32_TABLE[(this.checksum ^ data[i]) & 0xff /* 0b1111_1111 */];
    }
  }

  /**
   * Used by EventStreamCodec.
   * @internal
   */
  public digestSync(): number {
    return (this.checksum ^ ONES) >>> 0;
  }

  public async digest(): Promise<Uint8Array> {
    const value = this.digestSync();
    const out = new Uint8Array(4);
    new DataView(out.buffer).setUint32(0, value, false);
    return out;
  }

  public reset(): void {
    this.checksum = ONES;
  }
}
