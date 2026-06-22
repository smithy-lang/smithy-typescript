import { createHash, createHmac } from "node:crypto";
import type { Checksum, SourceData } from "@smithy/types";

import { Sha256Js } from "./Sha256Js";

const hasNativeCrypto = (() => {
  try {
    createHash("sha256");
    return true;
  } catch {
    return false;
  }
})();

/**
 * SHA-256 using Node.js crypto native implementation when available,
 * falling back to the pure JS implementation.
 * @public
 */
export interface Sha256Node extends Checksum {
  readonly digestLength: 32;
}

/**
 * @public
 */
export const Sha256Node: new (secret?: SourceData) => Sha256Node = hasNativeCrypto ? buildNativeClass() : Sha256Js;

function buildNativeClass() {
  return class Sha256Node implements Checksum {
    public readonly digestLength = 32 as const;
    private readonly secret?: SourceData;
    private hash: ReturnType<typeof createHash> | ReturnType<typeof createHmac>;
    private readonly isHmac: boolean;
    private finished = false;

    public constructor(secret?: SourceData) {
      this.secret = secret;
      this.isHmac = !!secret;
      this.hash = this.createHash();
    }

    public update(data: Uint8Array): void {
      if (this.finished) {
        throw new Error("Attempted to update an already finished hash.");
      }
      this.hash.update(data);
    }

    public async digest(): Promise<Uint8Array> {
      let buf: Buffer;
      if (this.isHmac) {
        this.finished = true;
        buf = (this.hash as ReturnType<typeof createHmac>).digest();
      } else {
        buf = (this.hash as ReturnType<typeof createHash>).copy().digest();
      }
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }

    public reset(): void {
      this.hash = this.createHash();
      this.finished = false;
    }

    private createHash() {
      return this.secret ? createHmac("sha256", toBuffer(this.secret)) : createHash("sha256");
    }
  };
}

function toBuffer(data: SourceData): Buffer | string {
  if (typeof data === "string") {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  return Buffer.from(data);
}
