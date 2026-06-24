import { createHash } from "node:crypto";
import { toUint8Array } from "@smithy/core/serde";
import type { Checksum, SourceData } from "@smithy/types";

import { Md5Js } from "./Md5Js";

const hasNativeCrypto = (() => {
  try {
    createHash("md5");
    return true;
  } catch {
    return false;
  }
})();

/**
 * MD5 using Node.js crypto native implementation when available,
 * falling back to the pure JS implementation.
 * @public
 */
export interface Md5Node extends Checksum {
  readonly digestLength: 16;

  /**
   * @override
   */
  update(data: SourceData): void;
}

/**
 * @public
 */
export const Md5Node: new () => Md5Node = hasNativeCrypto ? buildNativeClass() : Md5Js;

function buildNativeClass() {
  return class Md5Node implements Checksum {
    public readonly digestLength = 16 as const;
    private hash = createHash("md5");

    public update(data: SourceData): void {
      this.hash.update(toUint8Array(data));
    }

    public async digest(): Promise<Uint8Array> {
      const buf = this.hash.copy().digest();
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }

    public reset(): void {
      this.hash = createHash("md5");
    }
  };
}
