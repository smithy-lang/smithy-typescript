import { concatBytes, toUint8Array } from "@smithy/core/serde";
import type { Checksum, SourceData } from "@smithy/types";

import { Sha256Js } from "./Sha256Js";

const { digest, sign, importKey } = globalThis?.crypto?.subtle ?? {};
const subtle: SubtleCrypto | undefined =
  typeof digest === "function" && typeof sign === "function" && typeof importKey === "function"
    ? globalThis.crypto.subtle
    : undefined;

/**
 * Maximum bytes to buffer before falling back to streaming Sha256Js.
 * Prevents OOM when used with large payloads, since WebCrypto requires
 * all data in memory at once for digest().
 */
const MAX_PENDING_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * SHA-256 using the Web Crypto API (crypto.subtle) when available,
 * falling back to the pure JS implementation.
 *
 * Caution: this implementation is forced to buffer the data entirely.
 * Use the pure-JS or Sha256Node implementations for large streaming data.
 * @public
 */
export class Sha256WebCrypto implements Checksum {
  public readonly digestLength = 32 as const;
  private readonly secret?: Uint8Array;
  private pending: Uint8Array[] = [];
  private pendingBytes = 0;
  private fallback?: Sha256Js;
  private finished = false;

  public constructor(secret?: SourceData) {
    if (secret) {
      this.secret = toUint8Array(secret);
    }
  }

  public update(data: Uint8Array): void {
    if (this.finished) {
      throw new Error("Attempted to update an already finished HMAC.");
    }
    if (this.fallback) {
      this.fallback.update(data);
      return;
    }

    this.pending.push(data.slice());
    this.pendingBytes += data.byteLength;

    if (this.pendingBytes >= MAX_PENDING_BYTES) {
      this.switchToFallback();
    }
  }

  public async digest(): Promise<Uint8Array> {
    if (this.fallback) {
      return this.fallback.digest();
    }

    if (this.secret && this.finished) {
      throw new Error("Attempted to digest an already finished HMAC.");
    }

    const data = concatBytes(this.pending);
    if (subtle) {
      if (this.secret) {
        this.finished = true;
        const key = await subtle.importKey("raw", this.secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const sig = await subtle.sign("HMAC", key, data);
        return new Uint8Array(sig);
      }

      const hash = await subtle.digest("SHA-256", data);
      return new Uint8Array(hash);
    }

    const sha256 = new Sha256Js(this.secret);
    sha256.update(data);
    return sha256.digest();
  }

  public reset(): void {
    this.pending = [];
    this.pendingBytes = 0;
    this.fallback = undefined;
    this.finished = false;
  }

  private switchToFallback(): void {
    const sha256Js = new Sha256Js(this.secret);
    for (const chunk of this.pending) {
      sha256Js.update(chunk);
    }
    this.fallback = sha256Js;
    this.pending = [];
    this.pendingBytes = 0;
  }
}
