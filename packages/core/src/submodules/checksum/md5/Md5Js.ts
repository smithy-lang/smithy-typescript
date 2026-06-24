import { toUint8Array } from "@smithy/core/serde";
import type { Checksum, SourceData } from "@smithy/types";

/**
 * Pure-JS MD5 implementation. Used as fallback where node:crypto is unavailable.
 *
 * @public
 */
export class Md5Js implements Checksum {
  public readonly digestLength = 16;

  private state = Uint32Array.from(INIT);
  private writeBuffer = new DataView(new ArrayBuffer(64));
  private bufferLength = 0;
  private bytesHashed = 0;

  public update(sourceData: SourceData): void {
    const data = toUint8Array(sourceData);
    let pos = 0;
    let len = data.byteLength;
    this.bytesHashed += len;
    while (len > 0) {
      this.writeBuffer.setUint8(this.bufferLength++, data[pos++]);
      --len;
      if (this.bufferLength === 64) {
        compress(this.state, this.writeBuffer);
        this.bufferLength = 0;
      }
    }
  }

  /**
   * Non-destructive: works on copies so update() may continue after digest().
   */
  public async digest(): Promise<Uint8Array> {
    const state = Uint32Array.from(this.state);
    const buf = new DataView(this.writeBuffer.buffer.slice(0));
    let bufLen = this.bufferLength;

    const bits = this.bytesHashed * 8;
    buf.setUint8(bufLen++, 0x80 /* 0b1000_0000 padding start */);
    // Extra block needed if padding doesn't fit in remaining space.
    if (this.bufferLength % 64 >= 56 /* 64 - 8: no room for length */) {
      for (let i = bufLen; i < 64; ++i) {
        buf.setUint8(i, 0);
      }
      compress(state, buf);
      bufLen = 0;
    }
    for (let i = bufLen; i < 56; ++i) {
      buf.setUint8(i, 0);
    }
    buf.setUint32(56 /* 64 - 8 */, bits >>> 0, true);
    buf.setUint32(60 /* 64 - 4 */, Math.floor(bits / 2 ** 32 /* high 32 bits of 64-bit length */), true);
    compress(state, buf);

    const out = new Uint8Array(16);
    const view = new DataView(out.buffer);
    for (let i = 0; i < 4; ++i) {
      view.setUint32(i * 4, state[i], true);
    }
    return out;
  }

  public reset(): void {
    this.state.set(INIT);
    this.writeBuffer = new DataView(new ArrayBuffer(64));
    this.bufferLength = 0;
    this.bytesHashed = 0;
  }
}

// MD5 initial state: a0, b0, c0, d0.
const INIT = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];

// 32-bit truncation mask.
const M = 0xffffffff;

/**
 * Per-round shift amounts (one group of 4 per round, cycled).
 */
const S = Uint8Array.of(7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21);

/**
 * Pre-computed T[i] = floor(2^32 * abs(sin(i+1))).
 *
 * ```
 * 0xD76AA478, 0xE8C7B756, 0x242070DB, 0xC1BDCEEE, 0xF57C0FAF, 0x4787C62A, 0xA8304613, 0xFD469501,
 * 0x698098D8, 0x8B44F7AF, 0xFFFF5BB1, 0x895CD7BE, 0x6B901122, 0xFD987193, 0xA679438E, 0x49B40821,
 * 0xF61E2562, 0xC040B340, 0x265E5A51, 0xE9B6C7AA, 0xD62F105D, 0x02441453, 0xD8A1E681, 0xE7D3FBC8,
 * 0x21E1CDE6, 0xC33707D6, 0xF4D50D87, 0x455A14ED, 0xA9E3E905, 0xFCEFA3F8, 0x676F02D9, 0x8D2A4C8A,
 * 0xFFFA3942, 0x8771F681, 0x6D9D6122, 0xFDE5380C, 0xA4BEEA44, 0x4BDECFA9, 0xF6BB4B60, 0xBEBFBC70,
 * 0x289B7EC6, 0xEAA127FA, 0xD4EF3085, 0x04881D05, 0xD9D4D039, 0xE6DB99E5, 0x1FA27CF8, 0xC4AC5665,
 * 0xF4292244, 0x432AFF97, 0xAB9423A7, 0xFC93A039, 0x655B59C3, 0x8F0CCC92, 0xFFEFF47D, 0x85845DD1,
 * 0x6FA87E4F, 0xFE2CE6E0, 0xA3014314, 0x4E0811A1, 0xF7537E82, 0xBD3AF235, 0x2AD7D2BB, 0xEB86D391,
 * ```
 */
const T = Array.from({ length: 64 }, (_, i) => (Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

/**
 * MD5 block compression. Mutates state in place.
 */
function compress(state: Uint32Array, block: DataView): void {
  let a = state[0],
    b = state[1],
    c = state[2],
    d = state[3];

  for (let i = 0; i < 64; ++i) {
    let f: number, g: number;
    if (i < 16) {
      f = (b & c) | (~b & d);
      g = i;
    } else if (i < 32) {
      f = (d & b) | (c & ~d);
      g = (5 * i + 1) % 16;
    } else if (i < 48) {
      f = b ^ c ^ d;
      g = (3 * i + 5) % 16;
    } else {
      f = c ^ (b | ~d);
      g = (7 * i) % 16;
    }
    const x = block.getUint32(g * 4, true);
    const tmp = d;
    d = c;
    c = b;
    const s = S[(i >> 4) * 4 + (i & 3)];
    const sum = (((a + f) & M) + ((x + T[i]) & M)) & M;
    b = (b + (((sum << s) | (sum >>> (32 - s))) >>> 0)) & M;
    a = tmp;
  }

  state[0] = (state[0] + a) & M;
  state[1] = (state[1] + b) & M;
  state[2] = (state[2] + c) & M;
  state[3] = (state[3] + d) & M;
}
