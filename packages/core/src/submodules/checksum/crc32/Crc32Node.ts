import * as zlib from "node:zlib";
import type { Checksum } from "@smithy/types";

import { Crc32Js } from "./Crc32Js";

const zlibCrc32: ((data: Uint8Array, value?: number) => number) | undefined =
  typeof (zlib as any).crc32 === "function" ? (zlib as any).crc32 : undefined;

/**
 * CRC-32 using Node.js zlib native implementation when available,
 * falling back to the pure JS implementation.
 * @public
 */
export interface Crc32Node extends Checksum {
  readonly digestLength: 4;

  /**
   * Used by EventStreamCodec.
   * @internal
   */
  digestSync(): number;
}

/**
 * @public
 */
export const Crc32Node: new () => Crc32Node = zlibCrc32 ? buildNativeClass(zlibCrc32) : Crc32Js;

function buildNativeClass(nativeCrc32: (data: Uint8Array, value?: number) => number) {
  return class Crc32Node implements Checksum {
    readonly digestLength = 4 as const;
    private value = 0;

    public update(data: Uint8Array): void {
      this.value = nativeCrc32(data, this.value);
    }

    /**
     * Used by EventStreamCodec.
     * @internal
     */
    public digestSync(): number {
      return this.value >>> 0;
    }

    public async digest(): Promise<Uint8Array> {
      const out = new Uint8Array(4);
      new DataView(out.buffer).setUint32(0, this.digestSync(), false);
      return out;
    }

    public reset(): void {
      this.value = 0;
    }
  };
}
