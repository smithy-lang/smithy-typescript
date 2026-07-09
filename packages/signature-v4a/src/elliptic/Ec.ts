// @ts-nocheck
/* eslint-disable */
/**
 * Bundled from @noble/curves and @noble/hashes.
 *
 * The MIT License (MIT)
 * Copyright (c) 2022 Paul Miller (https://paulmillr.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/**
 * Checks if something is Uint8Array. Be careful: nodejs Buffer will return true.
 * @param a - value to test
 * @returns `true` when the value is a Uint8Array-compatible view.
 * @example
 * Check whether a value is a Uint8Array-compatible view.
 * ```ts
 * isBytes(new Uint8Array([1, 2, 3]));
 * ```
 */
function isBytes$1(a) {
  // Plain `instanceof Uint8Array` is too strict for some Buffer / proxy / cross-realm cases.
  // The fallback still requires a real ArrayBuffer view, so plain
  // JSON-deserialized `{ constructor: ... }` spoofing is rejected, and
  // `BYTES_PER_ELEMENT === 1` keeps the fallback on byte-oriented views.
  return (
    a instanceof Uint8Array ||
    (ArrayBuffer.isView(a) &&
      a.constructor.name === "Uint8Array" &&
      "BYTES_PER_ELEMENT" in a &&
      a.BYTES_PER_ELEMENT === 1)
  );
}
/**
 * Asserts something is a non-negative integer.
 * @param n - number to validate
 * @param title - label included in thrown errors
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Validate a non-negative integer option.
 * ```ts
 * anumber(32, 'length');
 * ```
 */
function anumber$1(n, title = "") {
  if (typeof n !== "number") {
    const prefix = title && `"${title}" `;
    throw new TypeError(`${prefix}expected number, got ${typeof n}`);
  }
  if (!Number.isSafeInteger(n) || n < 0) {
    const prefix = title && `"${title}" `;
    throw new RangeError(`${prefix}expected integer >= 0, got ${n}`);
  }
}
/**
 * Asserts something is Uint8Array.
 * @param value - value to validate
 * @param length - optional exact length constraint
 * @param title - label included in thrown errors
 * @returns The validated byte array.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Validate that a value is a byte array.
 * ```ts
 * abytes(new Uint8Array([1, 2, 3]));
 * ```
 */
function abytes$1(value, length, title = "") {
  const bytes = isBytes$1(value);
  const len = value?.length;
  const needsLen = length !== undefined;
  if (!bytes || (needsLen && len !== length)) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    const message = prefix + "expected Uint8Array" + ofLen + ", got " + got;
    if (!bytes) throw new TypeError(message);
    throw new RangeError(message);
  }
  return value;
}
/**
 * Asserts something is a wrapped hash constructor.
 * @param h - hash constructor to validate
 * @throws On wrong argument types or invalid hash wrapper shape. {@link TypeError}
 * @throws On invalid hash metadata ranges or values. {@link RangeError}
 * @throws If the hash metadata allows empty outputs or block sizes. {@link Error}
 * @example
 * Validate a callable hash wrapper.
 * ```ts
 * import { ahash } from '@noble/hashes/utils.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * ahash(sha256);
 * ```
 */
function ahash(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new TypeError("Hash must wrapped by utils.createHasher");
  anumber$1(h.outputLen);
  anumber$1(h.blockLen);
  // HMAC and KDF callers treat these as real byte lengths; allowing zero lets fake wrappers pass
  // validation and can produce empty outputs instead of failing fast.
  if (h.outputLen < 1) throw new Error('"outputLen" must be >= 1');
  if (h.blockLen < 1) throw new Error('"blockLen" must be >= 1');
}
/**
 * Asserts a hash instance has not been destroyed or finished.
 * @param instance - hash instance to validate
 * @param checkFinished - whether to reject finalized instances
 * @throws If the hash instance has already been destroyed or finalized. {@link Error}
 * @example
 * Validate that a hash instance is still usable.
 * ```ts
 * import { aexists } from '@noble/hashes/utils.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * const hash = sha256.create();
 * aexists(hash);
 * ```
 */
function aexists(instance, checkFinished = true) {
  if (instance.destroyed) throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished) throw new Error("Hash#digest() has already been called");
}
/**
 * Asserts output is a sufficiently-sized byte array.
 * @param out - destination buffer
 * @param instance - hash instance providing output length
 * Oversized buffers are allowed; downstream code only promises to fill the first `outputLen` bytes.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Validate a caller-provided digest buffer.
 * ```ts
 * import { aoutput } from '@noble/hashes/utils.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * const hash = sha256.create();
 * aoutput(new Uint8Array(hash.outputLen), hash);
 * ```
 */
function aoutput(out, instance) {
  abytes$1(out, undefined, "digestInto() output");
  const min = instance.outputLen;
  if (out.length < min) {
    throw new RangeError('"digestInto() output" expected to be of length >=' + min);
  }
}
/**
 * Zeroizes typed arrays in place. Warning: JS provides no guarantees.
 * @param arrays - arrays to overwrite with zeros
 * @example
 * Zeroize sensitive buffers in place.
 * ```ts
 * clean(new Uint8Array([1, 2, 3]));
 * ```
 */
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
/**
 * Creates a DataView for byte-level manipulation.
 * @param arr - source typed array
 * @returns DataView over the same buffer region.
 * @example
 * Create a DataView over an existing buffer.
 * ```ts
 * createView(new Uint8Array(4));
 * ```
 */
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
/**
 * Rotate-right operation for uint32 values.
 * @param word - source word
 * @param shift - shift amount in bits
 * @returns Rotated word.
 * @example
 * Rotate a 32-bit word to the right.
 * ```ts
 * rotr(0x12345678, 8);
 * ```
 */
function rotr(word, shift) {
  return (word << (32 - shift)) | (word >>> shift);
}
// Built-in hex conversion https://caniuse.com/mdn-javascript_builtins_uint8array_fromhex
const hasHexBuiltin = /* @__PURE__ */ (() =>
  // @ts-ignore
  typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function")();
// Array where index 0xf0 (240) is mapped to string 'f0'
const hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
/**
 * Convert byte array to hex string.
 * Uses the built-in function when available and assumes it matches the tested
 * fallback semantics.
 * @param bytes - bytes to encode
 * @returns Lowercase hexadecimal string.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Convert bytes to lowercase hexadecimal.
 * ```ts
 * bytesToHex(Uint8Array.from([0xca, 0xfe, 0x01, 0x23])); // 'cafe0123'
 * ```
 */
function bytesToHex$1(bytes) {
  abytes$1(bytes);
  // @ts-ignore
  if (hasHexBuiltin) return bytes.toHex();
  // pre-caching improves the speed 6x
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}
// We use optimized technique to convert hex string to byte array
const asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase16(ch) {
  if (ch >= asciis._0 && ch <= asciis._9) return ch - asciis._0; // '2' => 50-48
  if (ch >= asciis.A && ch <= asciis.F) return ch - (asciis.A - 10); // 'B' => 66-(65-10)
  if (ch >= asciis.a && ch <= asciis.f) return ch - (asciis.a - 10); // 'b' => 98-(97-10)
  return;
}
/**
 * Convert hex string to byte array. Uses built-in function, when available.
 * @param hex - hexadecimal string to decode
 * @returns Decoded bytes.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Decode lowercase hexadecimal into bytes.
 * ```ts
 * hexToBytes('cafe0123'); // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
 * ```
 */
function hexToBytes$1(hex) {
  if (typeof hex !== "string") throw new TypeError("hex string expected, got " + typeof hex);
  if (hasHexBuiltin) {
    try {
      return Uint8Array.fromHex(hex);
    } catch (error) {
      if (error instanceof SyntaxError) throw new RangeError(error.message);
      throw error;
    }
  }
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2) throw new RangeError("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex.charCodeAt(hi));
    const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
    if (n1 === undefined || n2 === undefined) {
      const char = hex[hi] + hex[hi + 1];
      throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2; // multiply first octet, e.g. 'a3' => 10*16+3 => 160 + 3 => 163
  }
  return array;
}
/**
 * Copies several Uint8Arrays into one.
 * @param arrays - arrays to concatenate
 * @returns Concatenated byte array.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Concatenate multiple byte arrays.
 * ```ts
 * concatBytes(new Uint8Array([1]), new Uint8Array([2]));
 * ```
 */
function concatBytes$1(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes$1(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}
/**
 * Creates a callable hash function from a stateful class constructor.
 * @param hashCons - hash constructor or factory
 * @param info - optional metadata such as DER OID
 * @returns Frozen callable hash wrapper with `.create()`.
 *   Wrapper construction eagerly calls `hashCons(undefined)` once to read
 *   `outputLen` / `blockLen`, so constructor side effects happen at module
 *   init time.
 * @example
 * Wrap a stateful hash constructor into a callable helper.
 * ```ts
 * import { createHasher } from '@noble/hashes/utils.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * const wrapped = createHasher(sha256.create, { oid: sha256.oid });
 * wrapped(new Uint8Array([1]));
 * ```
 */
function createHasher(hashCons, info = {}) {
  const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(undefined);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.canXOF = tmp.canXOF;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
/**
 * Cryptographically secure PRNG backed by `crypto.getRandomValues`.
 * @param bytesLength - number of random bytes to generate
 * @returns Random bytes.
 * The platform `getRandomValues()` implementation still defines any
 * single-call length cap, and this helper rejects oversize requests
 * with a stable library `RangeError` instead of host-specific errors.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @throws If the current runtime does not provide `crypto.getRandomValues`. {@link Error}
 * @example
 * Generate a fresh random key or nonce.
 * ```ts
 * const key = randomBytes(16);
 * ```
 */
function randomBytes$1(bytesLength = 32) {
  // Match the repo's other length-taking helpers instead of relying on Uint8Array coercion.
  anumber$1(bytesLength, "bytesLength");
  const cr = typeof globalThis === "object" ? globalThis.crypto : null;
  if (typeof cr?.getRandomValues !== "function") throw new Error("crypto.getRandomValues must be defined");
  // Web Cryptography API Level 2 §10.1.1:
  // if `byteLength > 65536`, throw `QuotaExceededError`.
  // Keep the guard explicit so callers can see the quota in code
  // instead of discovering it by reading the spec or host errors.
  // This wrapper surfaces the same quota as a stable library RangeError.
  if (bytesLength > 65536) throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
  return cr.getRandomValues(new Uint8Array(bytesLength));
}
/**
 * Creates OID metadata for NIST hashes with prefix `06 09 60 86 48 01 65 03 04 02`.
 * @param suffix - final OID byte for the selected hash.
 *   The helper accepts any byte even though only the documented NIST hash
 *   suffixes are meaningful downstream.
 * @returns Object containing the DER-encoded OID.
 * @example
 * Build OID metadata for a NIST hash.
 * ```ts
 * oidNist(0x01);
 * ```
 */
const oidNist = (suffix) => ({
  // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
  // Larger suffix values would need base-128 OID encoding and a different length byte.
  oid: Uint8Array.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, suffix]),
});

/**
 * Internal Merkle-Damgard hash utils.
 * @module
 */
/**
 * Shared 32-bit conditional boolean primitive reused by SHA-256, SHA-1, and MD5 `F`.
 * Returns bits from `b` when `a` is set, otherwise from `c`.
 * The XOR form is equivalent to MD5's `F(X,Y,Z) = XY v not(X)Z` because the masked terms never
 * set the same bit.
 * @param a - selector word
 * @param b - word chosen when selector bit is set
 * @param c - word chosen when selector bit is clear
 * @returns Mixed 32-bit word.
 * @example
 * Combine three words with the shared 32-bit choice primitive.
 * ```ts
 * Chi(0xffffffff, 0x12345678, 0x87654321);
 * ```
 */
function Chi(a, b, c) {
  return (a & b) ^ (~a & c);
}
/**
 * Shared 32-bit majority primitive reused by SHA-256 and SHA-1.
 * Returns bits shared by at least two inputs.
 * @param a - first input word
 * @param b - second input word
 * @param c - third input word
 * @returns Mixed 32-bit word.
 * @example
 * Combine three words with the shared 32-bit majority primitive.
 * ```ts
 * Maj(0xffffffff, 0x12345678, 0x87654321);
 * ```
 */
function Maj(a, b, c) {
  return (a & b) ^ (a & c) ^ (b & c);
}
/**
 * Merkle-Damgard hash construction base class.
 * Could be used to create MD5, RIPEMD, SHA1, SHA2.
 * Accepts only byte-aligned `Uint8Array` input, even when the underlying spec describes bit
 * strings with partial-byte tails.
 * @param blockLen - internal block size in bytes
 * @param outputLen - digest size in bytes
 * @param padOffset - trailing length field size in bytes
 * @param isLE - whether length and state words are encoded in little-endian
 * @example
 * Use a concrete subclass to get the shared Merkle-Damgard update/digest flow.
 * ```ts
 * import { _SHA1 } from '@noble/hashes/legacy.js';
 * const hash = new _SHA1();
 * hash.update(new Uint8Array([97, 98, 99]));
 * hash.digest();
 * ```
 */
class HashMD {
  blockLen;
  outputLen;
  canXOF = false;
  padOffset;
  isLE;
  // For partial updates less than block size
  buffer;
  view;
  finished = false;
  length = 0;
  pos = 0;
  destroyed = false;
  constructor(blockLen, outputLen, padOffset, isLE) {
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    abytes$1(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      // Fast path only when there is no buffered partial block: `take === blockLen` implies
      // `this.pos === 0`, so we can process full blocks directly from the input view.
      if (take === blockLen) {
        const dataView = createView(data);
        for (; blockLen <= len - pos; pos += blockLen) this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    // Padding
    // We can avoid allocation of buffer for padding completely if it
    // was previously not allocated here. But it won't change performance.
    const { buffer, view, blockLen, isLE } = this;
    let { pos } = this;
    // append the bit '1' to the message
    buffer[pos++] = 0b10000000;
    clean(this.buffer.subarray(pos));
    // we have less than padOffset left in buffer, so we cannot put length in
    // current block, need process it and pad again
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    // Pad until full block byte with zeros
    for (let i = pos; i < blockLen; i++) buffer[i] = 0;
    // `padOffset` reserves the whole length field. For SHA-384/512 the high 64 bits stay zero from
    // the padding fill above, and JS will overflow before user input can make that half non-zero.
    // So we only need to write the low 64 bits here.
    view.setBigUint64(blockLen - 8, BigInt(this.length * 8), isLE);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    // NOTE: we do division by 4 later, which must be fused in single op with modulo by JIT
    if (len % 4) throw new Error("_sha2: outputLen must be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length) throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0; i < outLen; i++) oview.setUint32(4 * i, state[i], isLE);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    // Copy before destroy(): subclasses wipe `buffer` during cleanup, but `digest()` must return
    // fresh bytes to the caller.
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to ||= new this.constructor();
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    // Only partial-block bytes need copying: when `length % blockLen === 0`, `pos === 0` and
    // later `update()` / `digestInto()` overwrite `to.buffer` from the start before reading it.
    if (length % blockLen) to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
}
/**
 * Initial SHA-2 state: fractional parts of square roots of first 16 primes 2..53.
 * Check out `test/misc/sha2-gen-iv.js` for recomputation guide.
 */
/** Initial SHA256 state from RFC 6234 §6.1: the first 32 bits of the fractional parts of the
 * square roots of the first eight prime numbers. Exported as a shared table; callers must treat
 * it as read-only because constructors copy words from it by index. */
const SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

/**
 * SHA2 hash function. A.k.a. sha256, sha384, sha512, sha512_224, sha512_256.
 * SHA256 is the fastest hash implementable in JS, even faster than Blake3.
 * Check out {@link https://www.rfc-editor.org/rfc/rfc4634 | RFC 4634} and
 * {@link https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf | FIPS 180-4}.
 * @module
 */
/**
 * SHA-224 / SHA-256 round constants from RFC 6234 §5.1: the first 32 bits
 * of the cube roots of the first 64 primes (2..311).
 */
// prettier-ignore
const SHA256_K = /* @__PURE__ */ Uint32Array.from([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);
/** Reusable SHA-224 / SHA-256 message schedule buffer `W_t` from RFC 6234 §6.2 step 1. */
const SHA256_W = /* @__PURE__ */ new Uint32Array(64);
/** Internal SHA-224 / SHA-256 compression engine from RFC 6234 §6.2. */
class SHA2_32B extends HashMD {
  constructor(outputLen) {
    super(64, outputLen, 8, false);
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  // prettier-ignore
  set(A, B, C, D, E, F, G, H) {
        this.A = A | 0;
        this.B = B | 0;
        this.C = C | 0;
        this.D = D | 0;
        this.E = E | 0;
        this.F = F | 0;
        this.G = G | 0;
        this.H = H | 0;
    }
  process(view, offset) {
    // Extend the first 16 words into the remaining 48 words w[16..63] of the message schedule array
    for (let i = 0; i < 16; i++, offset += 4) SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16; i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ (W15 >>> 3);
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ (W2 >>> 10);
      SHA256_W[i] = (s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16]) | 0;
    }
    // Compression function main loop, 64 rounds
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0; i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = (H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i]) | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = (sigma0 + Maj(A, B, C)) | 0;
      H = G;
      G = F;
      F = E;
      E = (D + T1) | 0;
      D = C;
      C = B;
      B = A;
      A = (T1 + T2) | 0;
    }
    // Add the compressed chunk to the current hash value
    A = (A + this.A) | 0;
    B = (B + this.B) | 0;
    C = (C + this.C) | 0;
    D = (D + this.D) | 0;
    E = (E + this.E) | 0;
    F = (F + this.F) | 0;
    G = (G + this.G) | 0;
    H = (H + this.H) | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    // HashMD callers route post-destroy usability through `destroyed`; zeroizing alone still leaves
    // update()/digest() callable on reused instances.
    this.destroyed = true;
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
}
/** Internal SHA-256 hash class grounded in RFC 6234 §6.2. */
class _SHA256 extends SHA2_32B {
  // We cannot use array here since array allows indexing by variable
  // which means optimizer/compiler cannot use registers.
  A = SHA256_IV[0] | 0;
  B = SHA256_IV[1] | 0;
  C = SHA256_IV[2] | 0;
  D = SHA256_IV[3] | 0;
  E = SHA256_IV[4] | 0;
  F = SHA256_IV[5] | 0;
  G = SHA256_IV[6] | 0;
  H = SHA256_IV[7] | 0;
  constructor() {
    super(32);
  }
}
/**
 * SHA2-256 hash function from RFC 4634. In JS it's the fastest: even faster than Blake3. Some info:
 *
 * - Trying 2^128 hashes would get 50% chance of collision, using birthday attack.
 * - BTC network is doing 2^70 hashes/sec (2^95 hashes/year) as per 2025.
 * - Each sha256 hash is executing 2^18 bit operations.
 * - Good 2024 ASICs can do 200Th/sec with 3500 watts of power, corresponding to 2^36 hashes/joule.
 * @param msg - message bytes to hash
 * @returns Digest bytes.
 * @example
 * Hash a message with SHA2-256.
 * ```ts
 * sha256(new Uint8Array([97, 98, 99]));
 * ```
 */
const sha256 = /* @__PURE__ */ createHasher(() => new _SHA256(), /* @__PURE__ */ oidNist(0x01));

/**
 * Hex, bytes and number utilities.
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
/**
 * Validates that a value is a byte array.
 * @param value - Value to validate.
 * @param length - Optional exact byte length.
 * @param title - Optional field name.
 * @returns Original byte array.
 * @example
 * Reject non-byte input before passing data into curve code.
 *
 * ```ts
 * abytes(new Uint8Array(1));
 * ```
 */
const abytes = (value, length, title) => abytes$1(value, length, title);
/**
 * Validates that a value is a non-negative safe integer.
 * @param n - Value to validate.
 * @param title - Optional field name.
 * @example
 * Validate a numeric length before allocating buffers.
 *
 * ```ts
 * anumber(1);
 * ```
 */
const anumber = anumber$1;
/**
 * Encodes bytes as lowercase hex.
 * @param bytes - Bytes to encode.
 * @returns Lowercase hex string.
 * @example
 * Serialize bytes as hex for logging or fixtures.
 *
 * ```ts
 * bytesToHex(Uint8Array.of(1, 2, 3));
 * ```
 */
const bytesToHex = bytesToHex$1;
/**
 * Concatenates byte arrays.
 * @param arrays - Byte arrays to join.
 * @returns Concatenated bytes.
 * @example
 * Join domain-separated chunks into one buffer.
 *
 * ```ts
 * concatBytes(Uint8Array.of(1), Uint8Array.of(2));
 * ```
 */
const concatBytes = (...arrays) => concatBytes$1(...arrays);
/**
 * Decodes lowercase or uppercase hex into bytes.
 * @param hex - Hex string to decode.
 * @returns Decoded bytes.
 * @example
 * Parse fixture hex into bytes before hashing.
 *
 * ```ts
 * hexToBytes('0102');
 * ```
 */
const hexToBytes = (hex) => hexToBytes$1(hex);
/**
 * Checks whether a value is a Uint8Array.
 * @param a - Value to inspect.
 * @returns `true` when `a` is a Uint8Array.
 * @example
 * Branch on byte input before decoding it.
 *
 * ```ts
 * isBytes(new Uint8Array(1));
 * ```
 */
const isBytes = isBytes$1;
/**
 * Reads random bytes from the platform CSPRNG.
 * @param bytesLength - Number of random bytes to read.
 * @returns Fresh random bytes.
 * @example
 * Generate a random seed for a keypair.
 *
 * ```ts
 * randomBytes(2);
 * ```
 */
const randomBytes = (bytesLength) => randomBytes$1(bytesLength);
const _0n$3 = /* @__PURE__ */ BigInt(0);
const _1n$3 = /* @__PURE__ */ BigInt(1);
/**
 * Validates that a flag is boolean.
 * @param value - Value to validate.
 * @param title - Optional field name.
 * @returns Original value.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Reject non-boolean option flags early.
 *
 * ```ts
 * abool(true);
 * ```
 */
function abool(value, title = "") {
  if (typeof value !== "boolean") {
    const prefix = title && `"${title}" `;
    throw new TypeError(prefix + "expected boolean, got type=" + typeof value);
  }
  return value;
}
/**
 * Validates that a value is a non-negative bigint or safe integer.
 * @param n - Value to validate.
 * @returns The same validated value.
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Validate one integer-like value before serializing it.
 *
 * ```ts
 * abignumber(1n);
 * ```
 */
function abignumber(n) {
  if (typeof n === "bigint") {
    if (!isPosBig(n)) throw new RangeError("positive bigint expected, got " + n);
  } else anumber(n);
  return n;
}
/**
 * Validates that a value is a safe integer.
 * @param value - Integer to validate.
 * @param title - Optional field name.
 * @throws On wrong argument types. {@link TypeError}
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Validate a window size before scalar arithmetic uses it.
 *
 * ```ts
 * asafenumber(1);
 * ```
 */
function asafenumber(value, title = "") {
  if (typeof value !== "number") {
    const prefix = title && `"${title}" `;
    throw new TypeError(prefix + "expected number, got type=" + typeof value);
  }
  if (!Number.isSafeInteger(value)) {
    const prefix = title && `"${title}" `;
    throw new RangeError(prefix + "expected safe integer, got " + value);
  }
}
/**
 * Encodes a bigint into even-length big-endian hex.
 * The historical "unpadded" name only means "no fixed-width field padding"; odd-length hex still
 * gets one leading zero nibble so the result always represents whole bytes.
 * @param num - Number to encode.
 * @returns Big-endian hex string.
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Encode a scalar into hex without a `0x` prefix.
 *
 * ```ts
 * numberToHexUnpadded(255n);
 * ```
 */
function numberToHexUnpadded(num) {
  const hex = abignumber(num).toString(16);
  return hex.length & 1 ? "0" + hex : hex;
}
/**
 * Parses a big-endian hex string into bigint.
 * Accepts odd-length hex through the native `BigInt('0x' + hex)` parser and currently surfaces the
 * same native `SyntaxError` for malformed hex instead of wrapping it in a library-specific error.
 * @param hex - Hex string without `0x`.
 * @returns Parsed bigint value.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Parse a scalar from fixture hex.
 *
 * ```ts
 * hexToNumber('ff');
 * ```
 */
function hexToNumber(hex) {
  if (typeof hex !== "string") throw new TypeError("hex string expected, got " + typeof hex);
  return hex === "" ? _0n$3 : BigInt("0x" + hex); // Big Endian
}
// BE: Big Endian, LE: Little Endian
/**
 * Parses big-endian bytes into bigint.
 * @param bytes - Bytes in big-endian order.
 * @returns Parsed bigint value.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Read a scalar encoded in network byte order.
 *
 * ```ts
 * bytesToNumberBE(Uint8Array.of(1, 0));
 * ```
 */
function bytesToNumberBE(bytes) {
  return hexToNumber(bytesToHex$1(bytes));
}
/**
 * Parses little-endian bytes into bigint.
 * @param bytes - Bytes in little-endian order.
 * @returns Parsed bigint value.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Read a scalar encoded in little-endian form.
 *
 * ```ts
 * bytesToNumberLE(Uint8Array.of(1, 0));
 * ```
 */
function bytesToNumberLE(bytes) {
  return hexToNumber(bytesToHex$1(copyBytes(abytes$1(bytes)).reverse()));
}
/**
 * Encodes a bigint into fixed-length big-endian bytes.
 * @param n - Number to encode.
 * @param len - Output length in bytes. Must be greater than zero.
 * @returns Big-endian byte array.
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Serialize a scalar into a 32-byte field element.
 *
 * ```ts
 * numberToBytesBE(255n, 2);
 * ```
 */
function numberToBytesBE(n, len) {
  anumber$1(len);
  if (len === 0) throw new RangeError("zero length");
  n = abignumber(n);
  const hex = n.toString(16);
  // Detect overflow before hex parsing so oversized values don't leak the shared odd-hex error.
  if (hex.length > len * 2) throw new RangeError("number too large");
  return hexToBytes$1(hex.padStart(len * 2, "0"));
}
/**
 * Encodes a bigint into fixed-length little-endian bytes.
 * @param n - Number to encode.
 * @param len - Output length in bytes.
 * @returns Little-endian byte array.
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Serialize a scalar for little-endian protocols.
 *
 * ```ts
 * numberToBytesLE(255n, 2);
 * ```
 */
function numberToBytesLE(n, len) {
  return numberToBytesBE(n, len).reverse();
}
/**
 * Copies Uint8Array. We can't use u8a.slice(), because u8a can be Buffer,
 * and Buffer#slice creates mutable copy. Never use Buffers!
 * @param bytes - Bytes to copy.
 * @returns Detached copy.
 * @example
 * Make an isolated copy before mutating serialized bytes.
 *
 * ```ts
 * copyBytes(Uint8Array.of(1, 2, 3));
 * ```
 */
function copyBytes(bytes) {
  // `Uint8Array.from(...)` would also accept arrays / other typed arrays. Keep this helper strict
  // because callers use it at byte-validation boundaries before mutating the detached copy.
  return Uint8Array.from(abytes(bytes));
}
// Historical name: this accepts non-negative bigints, including zero.
const isPosBig = (n) => typeof n === "bigint" && _0n$3 <= n;
/**
 * Checks whether a bigint lies inside a half-open range.
 * @param n - Candidate value.
 * @param min - Inclusive lower bound.
 * @param max - Exclusive upper bound.
 * @returns `true` when the value is inside the range.
 * @example
 * Check whether a candidate scalar fits the field order.
 *
 * ```ts
 * inRange(2n, 1n, 3n);
 * ```
 */
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
/**
 * Asserts `min <= n < max`. NOTE: upper bound is exclusive.
 * @param title - Value label for error messages.
 * @param n - Candidate value.
 * @param min - Inclusive lower bound.
 * @param max - Exclusive upper bound.
 * Wrong-type inputs are not separated from out-of-range values here: they still flow through the
 * shared `RangeError` path because this is only a throwing wrapper around `inRange(...)`.
 * @throws On wrong argument ranges or values. {@link RangeError}
 * @example
 * Assert that a bigint stays within one half-open range.
 *
 * ```ts
 * aInRange('x', 2n, 1n, 256n);
 * ```
 */
function aInRange(title, n, min, max) {
  // Why min <= n < max and not a (min < n < max) OR b (min <= n <= max)?
  // consider P=256n, min=0n, max=P
  // - a for min=0 would require -1:          `inRange('x', x, -1n, P)`
  // - b would commonly require subtraction:  `inRange('x', x, 0n, P - 1n)`
  // - our way is the cleanest:               `inRange('x', x, 0n, P)
  if (!inRange(n, min, max))
    throw new RangeError("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
// Bit operations
/**
 * Calculates amount of bits in a bigint.
 * Same as `n.toString(2).length`
 * TODO: merge with nLength in modular
 * @param n - Value to inspect.
 * @returns Bit length.
 * @throws If the value is negative. {@link Error}
 * @example
 * Measure the bit length of a scalar before serialization.
 *
 * ```ts
 * bitLen(8n);
 * ```
 */
function bitLen(n) {
  // Size callers in this repo only use non-negative orders / scalars, so negative inputs are a
  // contract bug and must not silently collapse to zero bits.
  if (n < _0n$3) throw new Error("expected non-negative bigint, got " + n);
  let len;
  for (len = 0; n > _0n$3; n >>= _1n$3, len += 1);
  return len;
}
/**
 * Calculate mask for N bits. Not using ** operator with bigints because of old engines.
 * Same as BigInt(`0b${Array(i).fill('1').join('')}`)
 * @param n - Number of bits. Negative widths are currently passed through to raw bigint shift
 *   semantics and therefore produce `-1n`.
 * @returns Bitmask value.
 * @example
 * Calculate mask for N bits.
 *
 * ```ts
 * bitMask(4);
 * ```
 */
const bitMask = (n) => (_1n$3 << BigInt(n)) - _1n$3;
/**
 * Minimal HMAC-DRBG from NIST 800-90 for RFC6979 sigs.
 * @param hashLen - Hash output size in bytes. Callers are expected to pass a positive length; `0`
 *   is not rejected here and would make the internal generate loop non-progressing.
 * @param qByteLen - Requested output size in bytes. Callers are expected to pass a positive length.
 * @param hmacFn - HMAC implementation.
 * @returns Function that will call DRBG until the predicate returns anything
 *   other than `undefined`.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Build a deterministic nonce generator for RFC6979-style signing.
 *
 * ```ts
 * import { createHmacDrbg } from '@noble/curves/utils.js';
 * import { hmac } from '@noble/hashes/hmac.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * const drbg = createHmacDrbg(32, 32, (key, msg) => hmac(sha256, key, msg));
 * const seed = new Uint8Array(32);
 * drbg(seed, (bytes) => bytes);
 * ```
 */
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
  anumber$1(hashLen, "hashLen");
  anumber$1(qByteLen, "qByteLen");
  if (typeof hmacFn !== "function") throw new TypeError("hmacFn must be a function");
  // creates Uint8Array
  const u8n = (len) => new Uint8Array(len);
  const NULL = Uint8Array.of();
  const byte0 = Uint8Array.of(0x00);
  const byte1 = Uint8Array.of(0x01);
  const _maxDrbgIters = 1000;
  // Step B, Step C: set hashLen to 8*ceil(hlen/8).
  // Minimal non-full-spec HMAC-DRBG from NIST 800-90 for RFC6979 signatures.
  let v = u8n(hashLen);
  // Steps B and C of RFC6979 3.2.
  let k = u8n(hashLen);
  let i = 0; // Iterations counter, will throw when over 1000
  const reset = () => {
    v.fill(1);
    k.fill(0);
    i = 0;
  };
  // hmac(k)(v, ...values)
  const h = (...msgs) => hmacFn(k, concatBytes(v, ...msgs));
  const reseed = (seed = NULL) => {
    // HMAC-DRBG reseed() function. Steps D-G
    k = h(byte0, seed); // k = hmac(k || v || 0x00 || seed)
    v = h(); // v = hmac(k || v)
    if (seed.length === 0) return;
    k = h(byte1, seed); // k = hmac(k || v || 0x01 || seed)
    v = h(); // v = hmac(k || v)
  };
  const gen = () => {
    // HMAC-DRBG generate() function
    if (i++ >= _maxDrbgIters) throw new Error("drbg: tried max amount of iterations");
    let len = 0;
    const out = [];
    while (len < qByteLen) {
      v = h();
      const sl = v.slice();
      out.push(sl);
      len += v.length;
    }
    return concatBytes(...out);
  };
  const genUntil = (seed, pred) => {
    reset();
    reseed(seed); // Steps D-G
    let res = undefined; // Step H: grind until the predicate accepts a candidate.
    // Falsy values like 0 are valid outputs.
    while ((res = pred(gen())) === undefined) reseed();
    reset();
    return res;
  };
  return genUntil;
}
/**
 * Validates declared required and optional field types on a plain object.
 * Extra keys are intentionally ignored because many callers validate only the subset they use from
 * richer option bags or runtime objects.
 * @param object - Object to validate.
 * @param fields - Required field types.
 * @param optFields - Optional field types.
 * @throws On wrong argument types. {@link TypeError}
 * @example
 * Check user options before building a curve helper.
 *
 * ```ts
 * validateObject({ flag: true }, { flag: 'boolean' });
 * ```
 */
function validateObject(object, fields = {}, optFields = {}) {
  if (Object.prototype.toString.call(object) !== "[object Object]")
    throw new TypeError("expected valid options object");
  function checkField(fieldName, expectedType, isOpt) {
    // Config/data fields must be explicit own properties, but runtime objects such as Field
    // instances intentionally satisfy required method slots via their shared prototype.
    if (!isOpt && expectedType !== "function" && !Object.hasOwn(object, fieldName))
      throw new TypeError(`param "${fieldName}" is invalid: expected own property`);
    const val = object[fieldName];
    if (isOpt && val === undefined) return;
    const current = typeof val;
    if (current !== expectedType || val === null)
      throw new TypeError(`param "${fieldName}" is invalid: expected ${expectedType}, got ${current}`);
  }
  const iter = (f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt));
  iter(fields, false);
  iter(optFields, true);
}

/**
 * Utils for modular division and fields.
 * Field over 11 is a finite (Galois) field is integer number operations `mod 11`.
 * There is no division: it is replaced by modular multiplicative inverse.
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
// Numbers aren't used in x25519 / x448 builds
// prettier-ignore
const _0n$2 = /* @__PURE__ */ BigInt(0), _1n$2 = /* @__PURE__ */ BigInt(1), _2n$1 = /* @__PURE__ */ BigInt(2);
// prettier-ignore
const _3n$1 = /* @__PURE__ */ BigInt(3), _4n$1 = /* @__PURE__ */ BigInt(4), _5n = /* @__PURE__ */ BigInt(5);
// prettier-ignore
const _7n = /* @__PURE__ */ BigInt(7), _8n = /* @__PURE__ */ BigInt(8), _9n = /* @__PURE__ */ BigInt(9);
const _16n = /* @__PURE__ */ BigInt(16);
/**
 * @param a - Dividend value.
 * @param b - Positive modulus.
 * @returns Reduced value in `[0, b)` only when `b` is positive.
 * @throws If the modulus is not positive. {@link Error}
 * @example
 * Normalize a bigint into one field residue.
 *
 * ```ts
 * mod(-1n, 5n);
 * ```
 */
function mod(a, b) {
  if (b <= _0n$2) throw new Error("mod: expected positive modulus, got " + b);
  const result = a % b;
  return result >= _0n$2 ? result : b + result;
}
/**
 * Inverses number over modulo.
 * Implemented using the {@link https://brilliant.org/wiki/extended-euclidean-algorithm/ | extended Euclidean algorithm}.
 * @param number - Value to invert.
 * @param modulo - Positive modulus.
 * @returns Multiplicative inverse.
 * @throws If the modulus is invalid or the inverse does not exist. {@link Error}
 * @example
 * Compute one modular inverse with the extended Euclidean algorithm.
 *
 * ```ts
 * invert(3n, 11n);
 * ```
 */
function invert(number, modulo) {
  if (number === _0n$2) throw new Error("invert: expected non-zero number");
  if (modulo <= _0n$2) throw new Error("invert: expected positive modulus, got " + modulo);
  // Fermat's little theorem "CT-like" version inv(n) = n^(m-2) mod m is 30x slower.
  let a = mod(number, modulo);
  let b = modulo;
  // prettier-ignore
  let x = _0n$2, u = _1n$2;
  while (a !== _0n$2) {
    const q = b / a;
    const r = b - a * q;
    const m = x - u * q;
    // prettier-ignore
    b = a, a = r, x = u, u = m;
  }
  const gcd = b;
  if (gcd !== _1n$2) throw new Error("invert: does not exist");
  return mod(x, modulo);
}
function assertIsSquare(Fp, root, n) {
  const F = Fp;
  if (!F.eql(F.sqr(root), n)) throw new Error("Cannot find square root");
}
// Not all roots are possible! Example which will throw:
// const NUM =
// n = 72057594037927816n;
// Fp = Field(BigInt('0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab'));
function sqrt3mod4(Fp, n) {
  const F = Fp;
  const p1div4 = (F.ORDER + _1n$2) / _4n$1;
  const root = F.pow(n, p1div4);
  assertIsSquare(F, root, n);
  return root;
}
// Equivalent `q = 5 (mod 8)` square-root formula (Atkin-style), not the RFC Appendix I.2 CMOV
// pseudocode verbatim.
function sqrt5mod8(Fp, n) {
  const F = Fp;
  const p5div8 = (F.ORDER - _5n) / _8n;
  const n2 = F.mul(n, _2n$1);
  const v = F.pow(n2, p5div8);
  const nv = F.mul(n, v);
  const i = F.mul(F.mul(nv, _2n$1), v);
  const root = F.mul(nv, F.sub(i, F.ONE));
  assertIsSquare(F, root, n);
  return root;
}
// Based on RFC9380, Kong algorithm
// prettier-ignore
function sqrt9mod16(P) {
    const Fp_ = Field(P);
    const tn = tonelliShanks(P);
    const c1 = tn(Fp_, Fp_.neg(Fp_.ONE)); //  1. c1 = sqrt(-1) in F, i.e., (c1^2) == -1 in F
    const c2 = tn(Fp_, c1); //  2. c2 = sqrt(c1) in F, i.e., (c2^2) == c1 in F
    const c3 = tn(Fp_, Fp_.neg(c1)); //  3. c3 = sqrt(-c1) in F, i.e., (c3^2) == -c1 in F
    const c4 = (P + _7n) / _16n; //  4. c4 = (q + 7) / 16        # Integer arithmetic
    return ((Fp, n) => {
        const F = Fp;
        let tv1 = F.pow(n, c4); //  1. tv1 = x^c4
        let tv2 = F.mul(tv1, c1); //  2. tv2 = c1 * tv1
        const tv3 = F.mul(tv1, c2); //  3. tv3 = c2 * tv1
        const tv4 = F.mul(tv1, c3); //  4. tv4 = c3 * tv1
        const e1 = F.eql(F.sqr(tv2), n); //  5.  e1 = (tv2^2) == x
        const e2 = F.eql(F.sqr(tv3), n); //  6.  e2 = (tv3^2) == x
        tv1 = F.cmov(tv1, tv2, e1); //  7. tv1 = CMOV(tv1, tv2, e1)  # Select tv2 if (tv2^2) == x
        tv2 = F.cmov(tv4, tv3, e2); //  8. tv2 = CMOV(tv4, tv3, e2)  # Select tv3 if (tv3^2) == x
        const e3 = F.eql(F.sqr(tv2), n); //  9.  e3 = (tv2^2) == x
        const root = F.cmov(tv1, tv2, e3); // 10.  z = CMOV(tv1, tv2, e3)   # Select sqrt from tv1 & tv2
        assertIsSquare(F, root, n);
        return root;
    });
}
/**
 * Tonelli-Shanks square root search algorithm.
 * This implementation is variable-time: it searches data-dependently for the first non-residue `Z`
 * and for the smallest `i` in the main loop, unlike RFC 9380 Appendix I.4's constant-time shape.
 * 1. {@link https://eprint.iacr.org/2012/685.pdf | eprint 2012/685}, page 12
 * 2. Square Roots from 1; 24, 51, 10 to Dan Shanks
 * @param P - field order
 * @returns function that takes field Fp (created from P) and number n
 * @throws If the field is too small, non-prime, or the square root does not exist. {@link Error}
 * @example
 * Construct a square-root helper for primes that need Tonelli-Shanks.
 *
 * ```ts
 * import { Field, tonelliShanks } from '@noble/curves/abstract/modular.js';
 * const Fp = Field(17n);
 * const sqrt = tonelliShanks(17n)(Fp, 4n);
 * ```
 */
function tonelliShanks(P) {
  // Initialization (precomputation).
  // Caching initialization could boost perf by 7%.
  if (P < _3n$1) throw new Error("sqrt is not defined for small field");
  // Factor P - 1 = Q * 2^S, where Q is odd
  let Q = P - _1n$2;
  let S = 0;
  while (Q % _2n$1 === _0n$2) {
    Q /= _2n$1;
    S++;
  }
  // Find the first quadratic non-residue Z >= 2
  let Z = _2n$1;
  const _Fp = Field(P);
  while (FpLegendre(_Fp, Z) === 1) {
    // Basic primality test for P. After x iterations, chance of
    // not finding quadratic non-residue is 2^x, so 2^1000.
    if (Z++ > 1000) throw new Error("Cannot find square root: probably non-prime P");
  }
  // Fast-path; usually done before Z, but we do "primality test".
  if (S === 1) return sqrt3mod4;
  // Slow-path
  // TODO: test on Fp2 and others
  let cc = _Fp.pow(Z, Q); // c = z^Q
  const Q1div2 = (Q + _1n$2) / _2n$1;
  return function tonelliSlow(Fp, n) {
    const F = Fp;
    if (F.is0(n)) return n;
    // Check if n is a quadratic residue using Legendre symbol
    if (FpLegendre(F, n) !== 1) throw new Error("Cannot find square root");
    // Initialize variables for the main loop
    let M = S;
    let c = F.mul(F.ONE, cc); // c = z^Q, move cc from field _Fp into field Fp
    let t = F.pow(n, Q); // t = n^Q, first guess at the fudge factor
    let R = F.pow(n, Q1div2); // R = n^((Q+1)/2), first guess at the square root
    // Main loop
    // while t != 1
    while (!F.eql(t, F.ONE)) {
      if (F.is0(t)) return F.ZERO; // if t=0 return R=0
      let i = 1;
      // Find the smallest i >= 1 such that t^(2^i) ≡ 1 (mod P)
      let t_tmp = F.sqr(t); // t^(2^1)
      while (!F.eql(t_tmp, F.ONE)) {
        i++;
        t_tmp = F.sqr(t_tmp); // t^(2^2)...
        if (i === M) throw new Error("Cannot find square root");
      }
      // Calculate the exponent for b: 2^(M - i - 1)
      const exponent = _1n$2 << BigInt(M - i - 1); // bigint is important
      const b = F.pow(c, exponent); // b = 2^(M - i - 1)
      // Update variables
      M = i;
      c = F.sqr(b); // c = b^2
      t = F.mul(t, c); // t = (t * b^2)
      R = F.mul(R, b); // R = R*b
    }
    return R;
  };
}
/**
 * Square root for a finite field. Will try optimized versions first:
 *
 * 1. P ≡ 3 (mod 4)
 * 2. P ≡ 5 (mod 8)
 * 3. P ≡ 9 (mod 16)
 * 4. Tonelli-Shanks algorithm
 *
 * Different algorithms can give different roots, it is up to user to decide which one they want.
 * For example there is FpSqrtOdd/FpSqrtEven to choose a root by oddness
 * (used for hash-to-curve).
 * @param P - Field order.
 * @returns Square-root helper. The generic fallback inherits Tonelli-Shanks' variable-time
 *   behavior and this selector assumes prime-field-style integer moduli.
 * @throws If the field is unsupported or the square root does not exist. {@link Error}
 * @example
 * Choose the square-root helper appropriate for one field modulus.
 *
 * ```ts
 * import { Field, FpSqrt } from '@noble/curves/abstract/modular.js';
 * const Fp = Field(17n);
 * const sqrt = FpSqrt(17n)(Fp, 4n);
 * ```
 */
function FpSqrt(P) {
  // P ≡ 3 (mod 4) => √n = n^((P+1)/4)
  if (P % _4n$1 === _3n$1) return sqrt3mod4;
  // P ≡ 5 (mod 8) => Atkin algorithm, page 10 of https://eprint.iacr.org/2012/685.pdf
  if (P % _8n === _5n) return sqrt5mod8;
  // P ≡ 9 (mod 16) => Kong algorithm, page 11 of https://eprint.iacr.org/2012/685.pdf (algorithm 4)
  if (P % _16n === _9n) return sqrt9mod16(P);
  // Tonelli-Shanks algorithm
  return tonelliShanks(P);
}
// prettier-ignore
// Arithmetic-only subset checked by validateField(). This is intentionally not the full runtime
// IField contract: helpers like `isValidNot0`, `invertBatch`, `toBytes`, `fromBytes`, `cmov`, and
// field-specific extras like `isOdd` are left to the callers that actually need them.
const FIELD_FIELDS = [
    'create', 'isValid', 'is0', 'neg', 'inv', 'sqrt', 'sqr',
    'eql', 'add', 'sub', 'mul', 'pow', 'div',
    'addN', 'subN', 'mulN', 'sqrN'
];
/**
 * @param field - Field implementation.
 * @returns Validated field. This only checks the arithmetic subset needed by generic helpers; it
 *   does not guarantee full runtime-method coverage for serialization, batching, `cmov`, or
 *   field-specific extras beyond positive `BYTES` / `BITS`.
 * @throws If the field shape or numeric metadata are invalid. {@link Error}
 * @example
 * Check that a field implementation exposes the operations curve code expects.
 *
 * ```ts
 * import { Field, validateField } from '@noble/curves/abstract/modular.js';
 * const Fp = validateField(Field(17n));
 * ```
 */
function validateField(field) {
  const initial = {
    ORDER: "bigint",
    BYTES: "number",
    BITS: "number",
  };
  const opts = FIELD_FIELDS.reduce((map, val) => {
    map[val] = "function";
    return map;
  }, initial);
  validateObject(field, opts);
  // Runtime field implementations must expose real integer byte/bit sizes; fractional / NaN /
  // infinite metadata leaks through validateObject(type='number') but breaks encoders and caches.
  asafenumber(field.BYTES, "BYTES");
  asafenumber(field.BITS, "BITS");
  // Runtime field implementations must expose positive byte/bit sizes; zero leaks through the
  // numeric shape checks above but still breaks encoding helpers and cached-length assumptions.
  if (field.BYTES < 1 || field.BITS < 1) throw new Error("invalid field: expected BYTES/BITS > 0");
  if (field.ORDER <= _1n$2) throw new Error("invalid field: expected ORDER > 1, got " + field.ORDER);
  return field;
}
// Generic field functions
/**
 * Same as `pow` but for Fp: non-constant-time.
 * Unsafe in some contexts: uses ladder, so can expose bigint bits.
 * @param Fp - Field implementation.
 * @param num - Base value.
 * @param power - Exponent value.
 * @returns Powered field element.
 * @throws If the exponent is negative. {@link Error}
 * @example
 * Raise one field element to a public exponent.
 *
 * ```ts
 * import { Field, FpPow } from '@noble/curves/abstract/modular.js';
 * const Fp = Field(17n);
 * const x = FpPow(Fp, 3n, 5n);
 * ```
 */
function FpPow(Fp, num, power) {
  const F = Fp;
  if (power < _0n$2) throw new Error("invalid exponent, negatives unsupported");
  if (power === _0n$2) return F.ONE;
  if (power === _1n$2) return num;
  let p = F.ONE;
  let d = num;
  while (power > _0n$2) {
    if (power & _1n$2) p = F.mul(p, d);
    d = F.sqr(d);
    power >>= _1n$2;
  }
  return p;
}
/**
 * Efficiently invert an array of Field elements.
 * Exception-free. Zero-valued field elements stay `undefined` unless `passZero` is enabled.
 * @param Fp - Field implementation.
 * @param nums - Values to invert.
 * @param passZero - map 0 to 0 (instead of undefined)
 * @returns Inverted values.
 * @example
 * Invert several field elements with one shared inversion.
 *
 * ```ts
 * import { Field, FpInvertBatch } from '@noble/curves/abstract/modular.js';
 * const Fp = Field(17n);
 * const inv = FpInvertBatch(Fp, [1n, 2n, 4n]);
 * ```
 */
function FpInvertBatch(Fp, nums, passZero = false) {
  const F = Fp;
  const inverted = new Array(nums.length).fill(passZero ? F.ZERO : undefined);
  // Walk from first to last, multiply them by each other MOD p
  const multipliedAcc = nums.reduce((acc, num, i) => {
    if (F.is0(num)) return acc;
    inverted[i] = acc;
    return F.mul(acc, num);
  }, F.ONE);
  // Invert last element
  const invertedAcc = F.inv(multipliedAcc);
  // Walk from last to first, multiply them by inverted each other MOD p
  nums.reduceRight((acc, num, i) => {
    if (F.is0(num)) return acc;
    inverted[i] = F.mul(acc, inverted[i]);
    return F.mul(acc, num);
  }, invertedAcc);
  return inverted;
}
/**
 * Legendre symbol.
 * Legendre constant is used to calculate Legendre symbol (a | p)
 * which denotes the value of a^((p-1)/2) (mod p).
 *
 * * (a | p) ≡ 1    if a is a square (mod p), quadratic residue
 * * (a | p) ≡ -1   if a is not a square (mod p), quadratic non residue
 * * (a | p) ≡ 0    if a ≡ 0 (mod p)
 * @param Fp - Field implementation.
 * @param n - Value to inspect.
 * @returns Legendre symbol.
 * @throws If the field returns an invalid Legendre symbol value. {@link Error}
 * @example
 * Compute the Legendre symbol of one field element.
 *
 * ```ts
 * import { Field, FpLegendre } from '@noble/curves/abstract/modular.js';
 * const Fp = Field(17n);
 * const symbol = FpLegendre(Fp, 4n);
 * ```
 */
function FpLegendre(Fp, n) {
  const F = Fp;
  // We can use 3rd argument as optional cache of this value
  // but seems unneeded for now. The operation is very fast.
  const p1mod2 = (F.ORDER - _1n$2) / _2n$1;
  const powered = F.pow(n, p1mod2);
  const yes = F.eql(powered, F.ONE);
  const zero = F.eql(powered, F.ZERO);
  const no = F.eql(powered, F.neg(F.ONE));
  if (!yes && !zero && !no) throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero ? 0 : -1;
}
/**
 * @param n - Curve order. Callers are expected to pass a positive order.
 * @param nBitLength - Optional cached bit length. Callers are expected to pass a positive cached
 *   value when overriding the derived bit length.
 * @returns Byte and bit lengths.
 * @throws If the order or cached bit length is invalid. {@link Error}
 * @example
 * Measure the encoding sizes needed for one modulus.
 *
 * ```ts
 * nLength(255n);
 * ```
 */
function nLength(n, nBitLength) {
  // Bit size, byte size of CURVE.n
  if (nBitLength !== undefined) anumber(nBitLength);
  if (n <= _0n$2) throw new Error("invalid n length: expected positive n, got " + n);
  if (nBitLength !== undefined && nBitLength < 1)
    throw new Error("invalid n length: expected positive bit length, got " + nBitLength);
  const bits = bitLen(n);
  // Cached bit lengths smaller than ORDER would truncate serialized scalars/elements and poison
  // any math that relies on the derived field metadata.
  if (nBitLength !== undefined && nBitLength < bits)
    throw new Error(`invalid n length: expected bit length (${bits}) >= n.length (${nBitLength})`);
  const _nBitLength = nBitLength !== undefined ? nBitLength : bits;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
// Keep the lazy sqrt cache off-instance so Field(...) can return a frozen object. Otherwise the
// cached helper write would keep the field surface externally mutable.
const FIELD_SQRT = new WeakMap();
class _Field {
  ORDER;
  BITS;
  BYTES;
  isLE;
  ZERO = _0n$2;
  ONE = _1n$2;
  _lengths;
  _mod;
  constructor(ORDER, opts = {}) {
    // ORDER <= 1 is degenerate: ONE would not be a valid field element and helpers like pow/inv
    // would stop modeling field arithmetic.
    if (ORDER <= _1n$2) throw new Error("invalid field: expected ORDER > 1, got " + ORDER);
    let _nbitLength = undefined;
    this.isLE = false;
    if (opts != null && typeof opts === "object") {
      // Cached bit lengths are trusted here and should already be positive / consistent with ORDER.
      if (typeof opts.BITS === "number") _nbitLength = opts.BITS;
      if (typeof opts.sqrt === "function")
        // `_Field.prototype` is frozen below, so custom sqrt hooks must become own properties
        // explicitly instead of relying on writable prototype shadowing via assignment.
        Object.defineProperty(this, "sqrt", { value: opts.sqrt, enumerable: true });
      if (typeof opts.isLE === "boolean") this.isLE = opts.isLE;
      if (opts.allowedLengths) this._lengths = Object.freeze(opts.allowedLengths.slice());
      if (typeof opts.modFromBytes === "boolean") this._mod = opts.modFromBytes;
    }
    const { nBitLength, nByteLength } = nLength(ORDER, _nbitLength);
    if (nByteLength > 2048) throw new Error("invalid field: expected ORDER of <= 2048 bytes");
    this.ORDER = ORDER;
    this.BITS = nBitLength;
    this.BYTES = nByteLength;
    Object.freeze(this);
  }
  create(num) {
    return mod(num, this.ORDER);
  }
  isValid(num) {
    if (typeof num !== "bigint") throw new TypeError("invalid field element: expected bigint, got " + typeof num);
    return _0n$2 <= num && num < this.ORDER; // 0 is valid element, but it's not invertible
  }
  is0(num) {
    return num === _0n$2;
  }
  // is valid and invertible
  isValidNot0(num) {
    return !this.is0(num) && this.isValid(num);
  }
  isOdd(num) {
    return (num & _1n$2) === _1n$2;
  }
  neg(num) {
    return mod(-num, this.ORDER);
  }
  eql(lhs, rhs) {
    return lhs === rhs;
  }
  sqr(num) {
    return mod(num * num, this.ORDER);
  }
  add(lhs, rhs) {
    return mod(lhs + rhs, this.ORDER);
  }
  sub(lhs, rhs) {
    return mod(lhs - rhs, this.ORDER);
  }
  mul(lhs, rhs) {
    return mod(lhs * rhs, this.ORDER);
  }
  pow(num, power) {
    return FpPow(this, num, power);
  }
  div(lhs, rhs) {
    return mod(lhs * invert(rhs, this.ORDER), this.ORDER);
  }
  // Same as above, but doesn't normalize
  sqrN(num) {
    return num * num;
  }
  addN(lhs, rhs) {
    return lhs + rhs;
  }
  subN(lhs, rhs) {
    return lhs - rhs;
  }
  mulN(lhs, rhs) {
    return lhs * rhs;
  }
  inv(num) {
    return invert(num, this.ORDER);
  }
  sqrt(num) {
    // Caching sqrt helpers speeds up sqrt9mod16 by 5x and Tonelli-Shanks by about 10% without keeping
    // the field instance itself mutable.
    let sqrt = FIELD_SQRT.get(this);
    if (!sqrt) FIELD_SQRT.set(this, (sqrt = FpSqrt(this.ORDER)));
    return sqrt(this, num);
  }
  toBytes(num) {
    // Serialize fixed-width limbs without re-validating the field range. Callers that need a
    // canonical encoding must pass a valid element; some protocols intentionally serialize raw
    // residues here and reduce or validate them elsewhere.
    return this.isLE ? numberToBytesLE(num, this.BYTES) : numberToBytesBE(num, this.BYTES);
  }
  fromBytes(bytes, skipValidation = false) {
    abytes(bytes);
    const { _lengths: allowedLengths, BYTES, isLE, ORDER, _mod: modFromBytes } = this;
    if (allowedLengths) {
      // `allowedLengths` must list real positive byte lengths; otherwise empty input would get
      // padded into zero and silently decode as a field element.
      if (bytes.length < 1 || !allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
        throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
      }
      const padded = new Uint8Array(BYTES);
      // isLE add 0 to right, !isLE to the left.
      padded.set(bytes, isLE ? 0 : padded.length - bytes.length);
      bytes = padded;
    }
    if (bytes.length !== BYTES) throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
    let scalar = isLE ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
    if (modFromBytes) scalar = mod(scalar, ORDER);
    if (!skipValidation) if (!this.isValid(scalar)) throw new Error("invalid field element: outside of range 0..ORDER");
    // Range validation is optional here because some protocols intentionally decode raw residues
    // and reduce or validate them elsewhere.
    return scalar;
  }
  // TODO: we don't need it here, move out to separate fn
  invertBatch(lst) {
    return FpInvertBatch(this, lst);
  }
  // We can't move this out because Fp6, Fp12 implement it
  // and it's unclear what to return in there.
  cmov(a, b, condition) {
    // Field elements have `isValid(...)`; the CMOV branch bit is a direct runtime input, so reject
    // non-boolean selectors here instead of letting JS truthiness silently change arithmetic.
    abool(condition, "condition");
    return condition ? b : a;
  }
}
// Freeze the shared method surface too; otherwise callers can still poison every Field instance by
// monkey-patching `_Field.prototype` even if each instance is frozen.
Object.freeze(_Field.prototype);
/**
 * Creates a finite field. Major performance optimizations:
 * * 1. Denormalized operations like mulN instead of mul.
 * * 2. Identical object shape: never add or remove keys.
 * * 3. Frozen stable object shape; the lazy sqrt cache lives in a module-level `WeakMap`.
 * Fragile: always run a benchmark on a change.
 * Security note: operations and low-level serializers like `toBytes` don't check `isValid` for
 * all elements for performance and protocol-flexibility reasons; callers are responsible for
 * supplying valid elements when they need canonical field behavior.
 * This is low-level code, please make sure you know what you're doing.
 *
 * Note about field properties:
 * * CHARACTERISTIC p = prime number, number of elements in main subgroup.
 * * ORDER q = similar to cofactor in curves, may be composite `q = p^m`.
 *
 * @param ORDER - field order, probably prime, or could be composite
 * @param opts - Field options such as bit length or endianness. See {@link FieldOpts}.
 * @returns Frozen field instance with a stable object shape. This wrapper forwards `opts` straight
 *   into `_Field`, so it inherits `_Field`'s assumptions about cached sizes and `allowedLengths`.
 * @example
 * Construct one prime field with optional overrides.
 *
 * ```ts
 * Field(11n);
 * ```
 */
function Field(ORDER, opts = {}) {
  return new _Field(ORDER, opts);
}
/**
 * Returns total number of bytes consumed by the field element.
 * For example, 32 bytes for usual 256-bit weierstrass curve.
 * @param fieldOrder - number of field elements, usually CURVE.n. Callers are expected to pass an
 *   order greater than 1.
 * @returns byte length of field
 * @throws If the field order is not a bigint. {@link Error}
 * @example
 * Read the fixed-width byte length of one field.
 *
 * ```ts
 * getFieldBytesLength(255n);
 * ```
 */
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint") throw new Error("field order must be bigint");
  // Valid field elements are in 0..ORDER-1, so ORDER <= 1 would make the encoded range degenerate.
  if (fieldOrder <= _1n$2) throw new Error("field order must be greater than 1");
  // Valid field elements are < ORDER, so the maximal encoded element is ORDER - 1.
  const bitLength = bitLen(fieldOrder - _1n$2);
  return Math.ceil(bitLength / 8);
}
/**
 * Returns minimal amount of bytes that can be safely reduced
 * by field order.
 * Should be 2^-128 for 128-bit curve such as P256.
 * This is the reduction / modulo-bias lower bound; higher-level helpers may still impose a larger
 * absolute floor for policy reasons.
 * @param fieldOrder - number of field elements greater than 1, usually CURVE.n.
 * @returns byte length of target hash
 * @throws If the field order is invalid. {@link Error}
 * @example
 * Compute the minimum hash length needed for field reduction.
 *
 * ```ts
 * getMinHashLength(255n);
 * ```
 */
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
/**
 * "Constant-time" private key generation utility.
 * Can take (n + n/2) or more bytes of uniform input e.g. from CSPRNG or KDF
 * and convert them into private scalar, with the modulo bias being negligible.
 * Needs at least 48 bytes of input for 32-byte private key. The implementation also keeps a hard
 * 16-byte minimum even when `getMinHashLength(...)` is smaller, so toy-small inputs do not look
 * accidentally acceptable for real scalar derivation.
 * See {@link https://research.kudelskisecurity.com/2020/07/28/the-definitive-guide-to-modulo-bias-and-how-to-avoid-it/ | Kudelski's modulo-bias guide},
 * {@link https://csrc.nist.gov/publications/detail/fips/186/5/final | FIPS 186-5 appendix A.2}, and
 * {@link https://www.rfc-editor.org/rfc/rfc9380#section-5 | RFC 9380 section 5}. Unlike RFC 9380
 * `hash_to_field`, this helper intentionally maps into the non-zero private-scalar range `1..n-1`.
 * @param key - Uniform input bytes.
 * @param fieldOrder - Size of subgroup.
 * @param isLE - interpret hash bytes as LE num
 * @returns valid private scalar
 * @throws If the hash length or field order is invalid for scalar reduction. {@link Error}
 * @example
 * Map hash output into a private scalar range.
 *
 * ```ts
 * mapHashToField(new Uint8Array(48).fill(1), 255n);
 * ```
 */
function mapHashToField(key, fieldOrder, isLE = false) {
  abytes(key);
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = Math.max(getMinHashLength(fieldOrder), 16);
  // No toy-small inputs: the helper is for real scalar derivation, not tiny test curves. No huge
  // inputs: easier to reason about JS timing / allocation behavior.
  if (len < minLen || len > 1024) throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
  const num = isLE ? bytesToNumberLE(key) : bytesToNumberBE(key);
  // `mod(x, 11)` can sometimes produce 0. `mod(x, 10) + 1` is the same, but no 0
  const reduced = mod(num, fieldOrder - _1n$2) + _1n$2;
  return isLE ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}

/**
 * Methods for elliptic curve multiplication by scalars.
 * Contains wNAF, pippenger.
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
const _0n$1 = /* @__PURE__ */ BigInt(0);
const _1n$1 = /* @__PURE__ */ BigInt(1);
/**
 * Computes both candidates first, but the final selection still branches on `condition`, so this
 * is not a strict constant-time CMOV primitive.
 * @param condition - Whether to negate the point.
 * @param item - Point-like value.
 * @returns Original or negated value.
 * @example
 * Keep the point or return its negation based on one boolean branch.
 *
 * ```ts
 * import { negateCt } from '@noble/curves/abstract/curve.js';
 * import { p256 } from '@noble/curves/nist.js';
 * const maybeNegated = negateCt(true, p256.Point.BASE);
 * ```
 */
function negateCt(condition, item) {
  const neg = item.negate();
  return condition ? neg : item;
}
/**
 * Takes a bunch of Projective Points but executes only one
 * inversion on all of them. Inversion is very slow operation,
 * so this improves performance massively.
 * Optimization: converts a list of projective points to a list of identical points with Z=1.
 * Input points are left unchanged; the normalized points are returned as fresh instances.
 * @param c - Point constructor.
 * @param points - Projective points.
 * @returns Fresh projective points reconstructed from normalized affine coordinates.
 * @example
 * Batch-normalize projective points with a single shared inversion.
 *
 * ```ts
 * import { normalizeZ } from '@noble/curves/abstract/curve.js';
 * import { p256 } from '@noble/curves/nist.js';
 * const points = normalizeZ(p256.Point, [p256.Point.BASE, p256.Point.BASE.double()]);
 * ```
 */
function normalizeZ(c, points) {
  const invertedZs = FpInvertBatch(
    c.Fp,
    points.map((p) => p.Z)
  );
  return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
}
function validateW(W, bits) {
  if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
    throw new Error("invalid window size, expected [1.." + bits + "], got W=" + W);
}
function calcWOpts(W, scalarBits) {
  validateW(W, scalarBits);
  const windows = Math.ceil(scalarBits / W) + 1; // W=8 33. Not 32, because we skip zero
  const windowSize = 2 ** (W - 1); // W=8 128. Not 256, because we skip zero
  const maxNumber = 2 ** W; // W=8 256
  const mask = bitMask(W); // W=8 255 == mask 0b11111111
  const shiftBy = BigInt(W); // W=8 8
  return { windows, windowSize, mask, maxNumber, shiftBy };
}
function calcOffsets(n, window, wOpts) {
  const { windowSize, mask, maxNumber, shiftBy } = wOpts;
  let wbits = Number(n & mask); // extract W bits.
  let nextN = n >> shiftBy; // shift number by W bits.
  // What actually happens here:
  // const highestBit = Number(mask ^ (mask >> 1n));
  // let wbits2 = wbits - 1; // skip zero
  // if (wbits2 & highestBit) { wbits2 ^= Number(mask); // (~);
  // split if bits > max: +224 => 256-32
  if (wbits > windowSize) {
    // we skip zero, which means instead of `>= size-1`, we do `> size`
    wbits -= maxNumber; // -32, can be maxNumber - wbits, but then we need to set isNeg here.
    nextN += _1n$1; // +256 (carry)
  }
  const offsetStart = window * windowSize;
  const offset = offsetStart + Math.abs(wbits) - 1; // -1 because we skip zero; ignore when isZero
  const isZero = wbits === 0; // is current window slice a 0?
  const isNeg = wbits < 0; // is current window slice negative?
  const isNegF = window % 2 !== 0; // fake branch noise only
  const offsetF = offsetStart; // fake branch noise only
  return { nextN, offset, isZero, isNeg, isNegF, offsetF };
}
// Since points in different groups cannot be equal (different object constructor),
// we can have single place to store precomputes.
// Allows to make points frozen / immutable.
const pointPrecomputes = new WeakMap();
const pointWindowSizes = new WeakMap();
function getW(P) {
  // To disable precomputes:
  // return 1;
  // `1` is also the uncached sentinel: use the ladder / non-precomputed path.
  return pointWindowSizes.get(P) || 1;
}
function assert0(n) {
  // Internal invariant: a non-zero remainder here means the wNAF window decomposition or loop
  // count is inconsistent, not that the original caller provided a bad scalar.
  if (n !== _0n$1) throw new Error("invalid wNAF");
}
/**
 * Elliptic curve multiplication of Point by scalar. Fragile.
 * Table generation takes **30MB of ram and 10ms on high-end CPU**,
 * but may take much longer on slow devices. Actual generation will happen on
 * first call of `multiply()`. By default, `BASE` point is precomputed.
 *
 * Scalars should always be less than curve order: this should be checked inside of a curve itself.
 * Creates precomputation tables for fast multiplication:
 * - private scalar is split by fixed size windows of W bits
 * - every window point is collected from window's table & added to accumulator
 * - since windows are different, same point inside tables won't be accessed more than once per calc
 * - each multiplication is 'Math.ceil(CURVE_ORDER / 𝑊) + 1' point additions (fixed for any scalar)
 * - +1 window is neccessary for wNAF
 * - wNAF reduces table size: 2x less memory + 2x faster generation, but 10% slower multiplication
 *
 * TODO: research returning a 2d JS array of windows instead of a single window.
 * This would allow windows to be in different memory locations.
 * @param Point - Point constructor.
 * @param bits - Scalar bit length.
 * @example
 * Elliptic curve multiplication of Point by scalar.
 *
 * ```ts
 * import { wNAF } from '@noble/curves/abstract/curve.js';
 * import { p256 } from '@noble/curves/nist.js';
 * const ladder = new wNAF(p256.Point, p256.Point.Fn.BITS);
 * ```
 */
class wNAF {
  BASE;
  ZERO;
  Fn;
  bits;
  // Parametrized with a given Point class (not individual point)
  constructor(Point, bits) {
    this.BASE = Point.BASE;
    this.ZERO = Point.ZERO;
    this.Fn = Point.Fn;
    this.bits = bits;
  }
  // non-const time multiplication ladder
  _unsafeLadder(elm, n, p = this.ZERO) {
    let d = elm;
    while (n > _0n$1) {
      if (n & _1n$1) p = p.add(d);
      d = d.double();
      n >>= _1n$1;
    }
    return p;
  }
  /**
   * Creates a wNAF precomputation window. Used for caching.
   * Default window size is set by `utils.precompute()` and is equal to 8.
   * Number of precomputed points depends on the curve size:
   * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
   * - 𝑊 is the window size
   * - 𝑛 is the bitlength of the curve order.
   * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
   * @param point - Point instance
   * @param W - window size
   * @returns precomputed point tables flattened to a single array
   */
  precomputeWindow(point, W) {
    const { windows, windowSize } = calcWOpts(W, this.bits);
    const points = [];
    let p = point;
    let base = p;
    for (let window = 0; window < windows; window++) {
      base = p;
      points.push(base);
      // i=1, bc we skip 0
      for (let i = 1; i < windowSize; i++) {
        base = base.add(p);
        points.push(base);
      }
      p = base.double();
    }
    return points;
  }
  /**
   * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
   * More compact implementation:
   * https://github.com/paulmillr/noble-secp256k1/blob/47cb1669b6e506ad66b35fe7d76132ae97465da2/index.ts#L502-L541
   * @returns real and fake (for const-time) points
   */
  wNAF(W, precomputes, n) {
    // Scalar should be smaller than field order
    if (!this.Fn.isValid(n)) throw new Error("invalid scalar");
    // Accumulators
    let p = this.ZERO;
    let f = this.BASE;
    // This code was first written with assumption that 'f' and 'p' will never be infinity point:
    // since each addition is multiplied by 2 ** W, it cannot cancel each other. However,
    // there is negate now: it is possible that negated element from low value
    // would be the same as high element, which will create carry into next window.
    // It's not obvious how this can fail, but still worth investigating later.
    const wo = calcWOpts(W, this.bits);
    for (let window = 0; window < wo.windows; window++) {
      // (n === _0n) is handled and not early-exited. isEven and offsetF are used for noise
      const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window, wo);
      n = nextN;
      if (isZero) {
        // bits are 0: add garbage to fake point
        // Important part for const-time getPublicKey: add random "noise" point to f.
        f = f.add(negateCt(isNegF, precomputes[offsetF]));
      } else {
        // bits are 1: add to result point
        p = p.add(negateCt(isNeg, precomputes[offset]));
      }
    }
    assert0(n);
    // Return both real and fake points so JIT keeps the noise path alive.
    // Known caveat: negate/carry interactions can still drive `f` to infinity even when `p` is not,
    // which weakens the noise path and leaves this only "less const-time" by about one bigint mul.
    return { p, f };
  }
  /**
   * Implements unsafe EC multiplication using precomputed tables
   * and w-ary non-adjacent form.
   * @param acc - accumulator point to add result of multiplication
   * @returns point
   */
  wNAFUnsafe(W, precomputes, n, acc = this.ZERO) {
    const wo = calcWOpts(W, this.bits);
    for (let window = 0; window < wo.windows; window++) {
      if (n === _0n$1) break; // Early-exit, skip 0 value
      const { nextN, offset, isZero, isNeg } = calcOffsets(n, window, wo);
      n = nextN;
      if (isZero) {
        // Window bits are 0: skip processing.
        // Move to next window.
        continue;
      } else {
        const item = precomputes[offset];
        acc = acc.add(isNeg ? item.negate() : item); // Re-using acc allows to save adds in MSM
      }
    }
    assert0(n);
    return acc;
  }
  getPrecomputes(W, point, transform) {
    // Cache key is only point identity plus the remembered window size; callers must not reuse the
    // same point with incompatible `transform(...)` layouts and expect a separate cache entry.
    let comp = pointPrecomputes.get(point);
    if (!comp) {
      comp = this.precomputeWindow(point, W);
      if (W !== 1) {
        // Doing transform outside of if brings 15% perf hit
        if (typeof transform === "function") comp = transform(comp);
        pointPrecomputes.set(point, comp);
      }
    }
    return comp;
  }
  cached(point, scalar, transform) {
    const W = getW(point);
    return this.wNAF(W, this.getPrecomputes(W, point, transform), scalar);
  }
  unsafe(point, scalar, transform, prev) {
    const W = getW(point);
    if (W === 1) return this._unsafeLadder(point, scalar, prev); // For W=1 ladder is ~x2 faster
    return this.wNAFUnsafe(W, this.getPrecomputes(W, point, transform), scalar, prev);
  }
  // We calculate precomputes for elliptic curve point multiplication
  // using windowed method. This specifies window size and
  // stores precomputed values. Usually only base point would be precomputed.
  createCache(P, W) {
    validateW(W, this.bits);
    pointWindowSizes.set(P, W);
    pointPrecomputes.delete(P);
  }
  hasCache(elm) {
    return getW(elm) !== 1;
  }
}
/**
 * Endomorphism-specific multiplication for Koblitz curves.
 * Cost: 128 dbl, 0-256 adds.
 * @param Point - Point constructor.
 * @param point - Input point.
 * @param k1 - First non-negative absolute scalar chunk.
 * @param k2 - Second non-negative absolute scalar chunk.
 * @returns Partial multiplication results.
 * @example
 * Endomorphism-specific multiplication for Koblitz curves.
 *
 * ```ts
 * import { mulEndoUnsafe } from '@noble/curves/abstract/curve.js';
 * import { secp256k1 } from '@noble/curves/secp256k1.js';
 * const parts = mulEndoUnsafe(secp256k1.Point, secp256k1.Point.BASE, 3n, 5n);
 * ```
 */
function mulEndoUnsafe(Point, point, k1, k2) {
  let acc = point;
  let p1 = Point.ZERO;
  let p2 = Point.ZERO;
  while (k1 > _0n$1 || k2 > _0n$1) {
    if (k1 & _1n$1) p1 = p1.add(acc);
    if (k2 & _1n$1) p2 = p2.add(acc);
    acc = acc.double();
    k1 >>= _1n$1;
    k2 >>= _1n$1;
  }
  return { p1, p2 };
}
function createField(order, field, isLE) {
  if (field) {
    // Reuse supplied field overrides as-is; `isLE` only affects freshly constructed fallback
    // fields, and validateField() below only checks the arithmetic subset, not full byte/cmov
    // behavior.
    if (field.ORDER !== order) throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
    validateField(field);
    return field;
  } else {
    return Field(order, { isLE });
  }
}
/**
 * Validates basic CURVE shape and field membership, then creates fields.
 * This does not prove that the generator is on-curve, that subgroup/order data are consistent, or
 * that the curve equation itself is otherwise sane.
 * @param type - Curve family.
 * @param CURVE - Curve parameters.
 * @param curveOpts - Optional field overrides:
 *   - `Fp` (optional): Optional base-field override.
 *   - `Fn` (optional): Optional scalar-field override.
 * @param FpFnLE - Whether field encoding is little-endian.
 * @returns Frozen curve parameters and fields.
 * @throws If the curve parameters or field overrides are invalid. {@link Error}
 * @example
 * Build curve fields from raw constants before constructing a curve instance.
 *
 * ```ts
 * const curve = createCurveFields('weierstrass', {
 *   p: 17n,
 *   n: 19n,
 *   h: 1n,
 *   a: 2n,
 *   b: 2n,
 *   Gx: 5n,
 *   Gy: 1n,
 * });
 * ```
 */
function createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
  if (FpFnLE === undefined) FpFnLE = type === "edwards";
  if (!CURVE || typeof CURVE !== "object") throw new Error(`expected valid ${type} CURVE object`);
  for (const p of ["p", "n", "h"]) {
    const val = CURVE[p];
    if (!(typeof val === "bigint" && val > _0n$1)) throw new Error(`CURVE.${p} must be positive bigint`);
  }
  const Fp = createField(CURVE.p, curveOpts.Fp, FpFnLE);
  const Fn = createField(CURVE.n, curveOpts.Fn, FpFnLE);
  const _b = "b";
  const params = ["Gx", "Gy", "a", _b];
  for (const p of params) {
    // @ts-ignore
    if (!Fp.isValid(CURVE[p])) throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
  }
  CURVE = Object.freeze(Object.assign({}, CURVE));
  return { CURVE, Fp, Fn };
}
/**
 * @param randomSecretKey - Secret-key generator.
 * @param getPublicKey - Public-key derivation helper.
 * @returns Keypair generator.
 * @example
 * Build a `keygen()` helper from existing secret-key and public-key primitives.
 *
 * ```ts
 * import { createKeygen } from '@noble/curves/abstract/curve.js';
 * import { p256 } from '@noble/curves/nist.js';
 * const keygen = createKeygen(p256.utils.randomSecretKey, p256.getPublicKey);
 * const pair = keygen();
 * ```
 */
function createKeygen(randomSecretKey, getPublicKey) {
  return function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey(secretKey) };
  };
}

/**
 * HMAC: RFC2104 message authentication code.
 * @module
 */
/**
 * Internal class for HMAC.
 * Accepts any byte key, although RFC 2104 §3 recommends keys at least
 * `HashLen` bytes long.
 */
class _HMAC {
  oHash;
  iHash;
  blockLen;
  outputLen;
  canXOF = false;
  finished = false;
  destroyed = false;
  constructor(hash, key) {
    ahash(hash);
    abytes$1(key, undefined, "key");
    this.iHash = hash.create();
    if (typeof this.iHash.update !== "function") throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    // blockLen can be bigger than outputLen
    pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
    for (let i = 0; i < pad.length; i++) pad[i] ^= 0x36;
    this.iHash.update(pad);
    // By doing update (processing of the first block) of the outer hash here,
    // we can re-use it between multiple calls via clone.
    this.oHash = hash.create();
    // Undo internal XOR && apply outer XOR
    for (let i = 0; i < pad.length; i++) pad[i] ^= 0x36 ^ 0x5c;
    this.oHash.update(pad);
    clean(pad);
  }
  update(buf) {
    aexists(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const buf = out.subarray(0, this.outputLen);
    // Reuse the first outputLen bytes for the inner digest; the outer hash consumes them before
    // overwriting that same prefix with the final tag, leaving any oversized tail untouched.
    this.iHash.digestInto(buf);
    this.oHash.update(buf);
    this.oHash.digestInto(buf);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    // Create new instance without calling constructor since the key
    // is already in state and we don't know it.
    to ||= Object.create(Object.getPrototypeOf(this), {});
    const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.oHash = oHash._cloneInto(to.oHash);
    to.iHash = iHash._cloneInto(to.iHash);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
}
const hmac = /* @__PURE__ */ (() => {
  const hmac_ = (hash, key, message) => new _HMAC(hash, key).update(message).digest();
  hmac_.create = (hash, key) => new _HMAC(hash, key);
  return hmac_;
})();

/**
 * Short Weierstrass curve methods. The formula is: y² = x³ + ax + b.
 *
 * ### Design rationale for types
 *
 * * Interaction between classes from different curves should fail:
 *   `k256.Point.BASE.add(p256.Point.BASE)`
 * * For this purpose we want to use `instanceof` operator, which is fast and works during runtime
 * * Different calls of `curve()` would return different classes -
 *   `curve(params) !== curve(params)`: if somebody decided to monkey-patch their curve,
 *   it won't affect others
 *
 * TypeScript can't infer types for classes created inside a function. Classes is one instance
 * of nominative types in TypeScript and interfaces only check for shape, so it's hard to create
 * unique type for every function call.
 *
 * We can use generic types via some param, like curve opts, but that would:
 *     1. Enable interaction between `curve(params)` and `curve(params)` (curves of same params)
 *     which is hard to debug.
 *     2. Params can be generic and we can't enforce them to be constant value:
 *     if somebody creates curve from non-constant params,
 *     it would be allowed to interact with other curves with non-constant params
 *
 * @todo https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-7.html#unique-symbol
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
// We construct the basis so `den` is always positive and equals `n`,
// but the `num` sign depends on the basis, not on the secret value.
// Exact half-way cases round away from zero, which keeps the split symmetric
// around the reduced-basis boundaries used by endomorphism decomposition.
const divNearest = (num, den) => (num + (num >= 0 ? den : -den) / _2n) / den;
/** Splits scalar for GLV endomorphism. */
function _splitEndoScalar(k, basis, n) {
  // Split scalar into two such that part is ~half bits: `abs(part) < sqrt(N)`
  // Since part can be negative, we need to do this on point.
  // Callers must provide a reduced GLV basis whose vectors satisfy
  // `a + b * lambda ≡ 0 (mod n)`; this helper only sees the basis and `n`.
  // Reject unreduced scalars instead of silently treating them mod n.
  aInRange("scalar", k, _0n, n);
  // TODO: verifyScalar function which consumes lambda
  const [[a1, b1], [a2, b2]] = basis;
  const c1 = divNearest(b2 * k, n);
  const c2 = divNearest(-b1 * k, n);
  // |k1|/|k2| is < sqrt(N), but can be negative.
  // If we do `k1 mod N`, we'll get big scalar (`> sqrt(N)`): so, we do cheaper negation instead.
  let k1 = k - c1 * a1 - c2 * a2;
  let k2 = -c1 * b1 - c2 * b2;
  const k1neg = k1 < _0n;
  const k2neg = k2 < _0n;
  if (k1neg) k1 = -k1;
  if (k2neg) k2 = -k2;
  // Double check that resulting scalar less than half bits of N: otherwise wNAF will fail.
  // This should only happen on wrong bases.
  // Also, the math inside is complex enough that this guard is worth keeping.
  const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n; // Half bits of N
  if (k1 < _0n || k1 >= MAX_NUM || k2 < _0n || k2 >= MAX_NUM) {
    throw new Error("splitScalar (endomorphism): failed for k");
  }
  return { k1neg, k1, k2neg, k2 };
}
function validateSigFormat(format) {
  if (!["compact", "recovered", "der"].includes(format))
    throw new Error('Signature format must be "compact", "recovered", or "der"');
  return format;
}
function validateSigOpts(opts, def) {
  validateObject(opts);
  const optsn = {};
  // Normalize only the declared option subset from `def`; unknown keys are
  // intentionally ignored so shared / superset option bags stay valid here too.
  // `extraEntropy` stays an opaque payload until the signing path consumes it.
  for (let optName of Object.keys(def)) {
    // @ts-ignore
    optsn[optName] = opts[optName] === undefined ? def[optName] : opts[optName];
  }
  abool(optsn.lowS, "lowS");
  abool(optsn.prehash, "prehash");
  if (optsn.format !== undefined) validateSigFormat(optsn.format);
  return optsn;
}
/**
 * @param m - Error message.
 * @example
 * Throw a DER-specific error when signature parsing encounters invalid bytes.
 *
 * ```ts
 * new DERErr('bad der');
 * ```
 */
class DERErr extends Error {
  constructor(m = "") {
    super(m);
  }
}
/**
 * ASN.1 DER encoding utilities. ASN is very complex & fragile. Format:
 *
 *     [0x30 (SEQUENCE), bytelength, 0x02 (INTEGER), intLength, R, 0x02 (INTEGER), intLength, S]
 *
 * Docs: {@link https://letsencrypt.org/docs/a-warm-welcome-to-asn1-and-der/ | Let's Encrypt ASN.1 guide} and
 * {@link https://luca.ntop.org/Teaching/Appunti/asn1.html | Luca Deri's ASN.1 notes}.
 * @example
 * ASN.1 DER encoding utilities.
 *
 * ```ts
 * const der = DER.hexFromSig({ r: 1n, s: 2n });
 * ```
 */
const DER = {
  // asn.1 DER encoding utils
  Err: DERErr,
  // Basic building block is TLV (Tag-Length-Value)
  _tlv: {
    encode: (tag, data) => {
      const { Err: E } = DER;
      asafenumber(tag, "tag");
      if (tag < 0 || tag > 255) throw new E("tlv.encode: wrong tag");
      if (typeof data !== "string") throw new TypeError('"data" expected string, got type=' + typeof data);
      // Internal helper: callers hand this already-validated hex payload, so we only enforce
      // byte alignment here instead of re-validating every nibble.
      if (data.length & 1) throw new E("tlv.encode: unpadded data");
      const dataLen = data.length / 2;
      const len = numberToHexUnpadded(dataLen);
      if ((len.length / 2) & 0b1000_0000) throw new E("tlv.encode: long form length too big");
      // length of length with long form flag
      const lenLen = dataLen > 127 ? numberToHexUnpadded((len.length / 2) | 0b1000_0000) : "";
      const t = numberToHexUnpadded(tag);
      return t + lenLen + len + data;
    },
    // v - value, l - left bytes (unparsed)
    decode(tag, data) {
      const { Err: E } = DER;
      data = abytes(data, undefined, "DER data");
      let pos = 0;
      if (tag < 0 || tag > 255) throw new E("tlv.encode: wrong tag");
      if (data.length < 2 || data[pos++] !== tag) throw new E("tlv.decode: wrong tlv");
      const first = data[pos++];
      // First bit of first length byte is the short/long form flag.
      const isLong = !!(first & 0b1000_0000);
      let length = 0;
      if (!isLong) length = first;
      else {
        // Long form: [longFlag(1bit), lengthLength(7bit), length (BE)]
        const lenLen = first & 0b0111_1111;
        if (!lenLen) throw new E("tlv.decode(long): indefinite length not supported");
        // This would overflow u32 in JS.
        if (lenLen > 4) throw new E("tlv.decode(long): byte length is too big");
        const lengthBytes = data.subarray(pos, pos + lenLen);
        if (lengthBytes.length !== lenLen) throw new E("tlv.decode: length bytes not complete");
        if (lengthBytes[0] === 0) throw new E("tlv.decode(long): zero leftmost byte");
        for (const b of lengthBytes) length = (length << 8) | b;
        pos += lenLen;
        if (length < 128) throw new E("tlv.decode(long): not minimal encoding");
      }
      const v = data.subarray(pos, pos + length);
      if (v.length !== length) throw new E("tlv.decode: wrong value length");
      return { v, l: data.subarray(pos + length) };
    },
  },
  // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
  // since we always use positive integers here. It must always be empty:
  // - add zero byte if exists
  // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
  _int: {
    encode(num) {
      const { Err: E } = DER;
      abignumber(num);
      if (num < _0n) throw new E("integer: negative integers are not allowed");
      let hex = numberToHexUnpadded(num);
      // Pad with zero byte if negative flag is present
      if (Number.parseInt(hex[0], 16) & 0b1000) hex = "00" + hex;
      if (hex.length & 1) throw new E("unexpected DER parsing assertion: unpadded hex");
      return hex;
    },
    decode(data) {
      const { Err: E } = DER;
      if (data.length < 1) throw new E("invalid signature integer: empty");
      if (data[0] & 0b1000_0000) throw new E("invalid signature integer: negative");
      // Single-byte zero `00` is the canonical DER INTEGER encoding for zero.
      if (data.length > 1 && data[0] === 0x00 && !(data[1] & 0b1000_0000))
        throw new E("invalid signature integer: unnecessary leading zero");
      return bytesToNumberBE(data);
    },
  },
  toSig(bytes) {
    // parse DER signature
    const { Err: E, _int: int, _tlv: tlv } = DER;
    const data = abytes(bytes, undefined, "signature");
    const { v: seqBytes, l: seqLeftBytes } = tlv.decode(0x30, data);
    if (seqLeftBytes.length) throw new E("invalid signature: left bytes after parsing");
    const { v: rBytes, l: rLeftBytes } = tlv.decode(0x02, seqBytes);
    const { v: sBytes, l: sLeftBytes } = tlv.decode(0x02, rLeftBytes);
    if (sLeftBytes.length) throw new E("invalid signature: left bytes after parsing");
    return { r: int.decode(rBytes), s: int.decode(sBytes) };
  },
  hexFromSig(sig) {
    const { _tlv: tlv, _int: int } = DER;
    const rs = tlv.encode(0x02, int.encode(sig.r));
    const ss = tlv.encode(0x02, int.encode(sig.s));
    const seq = rs + ss;
    return tlv.encode(0x30, seq);
  },
};
Object.freeze(DER._tlv);
Object.freeze(DER._int);
Object.freeze(DER);
// Be friendly to bad ECMAScript parsers by not using bigint literals
// prettier-ignore
const _0n = /* @__PURE__ */ BigInt(0), _1n = /* @__PURE__ */ BigInt(1), _2n = /* @__PURE__ */ BigInt(2), _3n = /* @__PURE__ */ BigInt(3), _4n = /* @__PURE__ */ BigInt(4);
/**
 * Creates weierstrass Point constructor, based on specified curve options.
 *
 * See {@link WeierstrassOpts}.
 * @param params - Curve parameters. See {@link WeierstrassOpts}.
 * @param extraOpts - Optional helpers and overrides. See {@link WeierstrassExtraOpts}.
 * @returns Weierstrass point constructor.
 * @throws If the curve parameters, overrides, or point codecs are invalid. {@link Error}
 *
 * @example
 * Construct a point type from explicit Weierstrass curve parameters.
 *
 * ```js
 * const opts = {
 *   p: 0xfffffffffffffffffffffffffffffffeffffac73n,
 *   n: 0x100000000000000000001b8fa16dfab9aca16b6b3n,
 *   h: 1n,
 *   a: 0n,
 *   b: 7n,
 *   Gx: 0x3b4c382ce37aa192a4019e763036f4f5dd4d7ebbn,
 *   Gy: 0x938cf935318fdced6bc28286531733c3f03c4feen,
 * };
 * const secp160k1_Point = weierstrass(opts);
 * ```
 */
function weierstrass(params, extraOpts = {}) {
  const validated = createCurveFields("weierstrass", params, extraOpts);
  const Fp = validated.Fp;
  const Fn = validated.Fn;
  let CURVE = validated.CURVE;
  const { h: cofactor, n: CURVE_ORDER } = CURVE;
  validateObject(
    extraOpts,
    {},
    {
      allowInfinityPoint: "boolean",
      clearCofactor: "function",
      isTorsionFree: "function",
      fromBytes: "function",
      toBytes: "function",
      endo: "object",
    }
  );
  // Snapshot constructor-time flags whose later mutation would otherwise change
  // validity semantics of an already-built point type.
  const { endo, allowInfinityPoint } = extraOpts;
  if (endo) {
    // validateObject(endo, { beta: 'bigint', splitScalar: 'function' });
    if (!Fp.is0(CURVE.a) || typeof endo.beta !== "bigint" || !Array.isArray(endo.basises)) {
      throw new Error('invalid endo: expected "beta": bigint and "basises": array');
    }
  }
  const lengths = getWLengths(Fp, Fn);
  function assertCompressionIsSupported() {
    if (!Fp.isOdd) throw new Error("compression is not supported: Field does not have .isOdd()");
  }
  // Implements IEEE P1363 point encoding
  function pointToBytes(_c, point, isCompressed) {
    // SEC 1 v2.0 §2.3.3 encodes infinity as the single octet 0x00. Only curves
    // that opt into infinity as a public point value should expose that byte form.
    if (allowInfinityPoint && point.is0()) return Uint8Array.of(0);
    const { x, y } = point.toAffine();
    const bx = Fp.toBytes(x);
    abool(isCompressed, "isCompressed");
    if (isCompressed) {
      assertCompressionIsSupported();
      const hasEvenY = !Fp.isOdd(y);
      return concatBytes(pprefix(hasEvenY), bx);
    } else {
      return concatBytes(Uint8Array.of(0x04), bx, Fp.toBytes(y));
    }
  }
  function pointFromBytes(bytes) {
    abytes(bytes, undefined, "Point");
    const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths; // e.g. for 32-byte: 33, 65
    const length = bytes.length;
    const head = bytes[0];
    const tail = bytes.subarray(1);
    if (allowInfinityPoint && length === 1 && head === 0x00) return { x: Fp.ZERO, y: Fp.ZERO };
    // SEC 1 v2.0 §2.3.4 decodes 0x00 as infinity, but §3.2.2 public-key validation
    // rejects infinity. We therefore keep 0x00 rejected by default because callers
    // reuse this parser as the strict public-key boundary, and only admit it when
    // the curve explicitly opts into infinity as a public point value. secp256k1
    // crosstests show OpenSSL raw point codecs accept 0x00 too.
    // No actual validation is done here: use .assertValidity()
    if (length === comp && (head === 0x02 || head === 0x03)) {
      const x = Fp.fromBytes(tail);
      if (!Fp.isValid(x)) throw new Error("bad point: is not on curve, wrong x");
      const y2 = weierstrassEquation(x); // y² = x³ + ax + b
      let y;
      try {
        y = Fp.sqrt(y2); // y = y² ^ (p+1)/4
      } catch (sqrtError) {
        const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
        throw new Error("bad point: is not on curve, sqrt error" + err);
      }
      assertCompressionIsSupported();
      const evenY = Fp.isOdd(y);
      const evenH = (head & 1) === 1; // ECDSA-specific
      if (evenH !== evenY) y = Fp.neg(y);
      return { x, y };
    } else if (length === uncomp && head === 0x04) {
      // TODO: more checks
      const L = Fp.BYTES;
      const x = Fp.fromBytes(tail.subarray(0, L));
      const y = Fp.fromBytes(tail.subarray(L, L * 2));
      if (!isValidXY(x, y)) throw new Error("bad point: is not on curve");
      return { x, y };
    } else {
      throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
    }
  }
  const encodePoint = extraOpts.toBytes === undefined ? pointToBytes : extraOpts.toBytes;
  const decodePoint = extraOpts.fromBytes === undefined ? pointFromBytes : extraOpts.fromBytes;
  function weierstrassEquation(x) {
    const x2 = Fp.sqr(x); // x * x
    const x3 = Fp.mul(x2, x); // x² * x
    return Fp.add(Fp.add(x3, Fp.mul(x, CURVE.a)), CURVE.b); // x³ + a * x + b
  }
  // TODO: move top-level
  /** Checks whether equation holds for given x, y: y² == x³ + ax + b */
  function isValidXY(x, y) {
    const left = Fp.sqr(y); // y²
    const right = weierstrassEquation(x); // x³ + ax + b
    return Fp.eql(left, right);
  }
  // Keep constructor-time generator validation cheap: callers are responsible for supplying the
  // correct prime-order base point, while eager subgroup checks here would slow heavy module imports.
  // Test 1: equation y² = x³ + ax + b should work for generator point.
  if (!isValidXY(CURVE.Gx, CURVE.Gy)) throw new Error("bad curve params: generator point");
  // Test 2: discriminant Δ part should be non-zero: 4a³ + 27b² != 0.
  // Guarantees curve is genus-1, smooth (non-singular).
  const _4a3 = Fp.mul(Fp.pow(CURVE.a, _3n), _4n);
  const _27b2 = Fp.mul(Fp.sqr(CURVE.b), BigInt(27));
  if (Fp.is0(Fp.add(_4a3, _27b2))) throw new Error("bad curve params: a or b");
  /** Asserts coordinate is valid: 0 <= n < Fp.ORDER. */
  function acoord(title, n, banZero = false) {
    if (!Fp.isValid(n) || (banZero && Fp.is0(n))) throw new Error(`bad point coordinate ${title}`);
    return n;
  }
  function aprjpoint(other) {
    if (!(other instanceof Point)) throw new Error("Weierstrass Point expected");
  }
  function splitEndoScalarN(k) {
    if (!endo || !endo.basises) throw new Error("no endo");
    return _splitEndoScalar(k, endo.basises, Fn.ORDER);
  }
  function finishEndo(endoBeta, k1p, k2p, k1neg, k2neg) {
    k2p = new Point(Fp.mul(k2p.X, endoBeta), k2p.Y, k2p.Z);
    k1p = negateCt(k1neg, k1p);
    k2p = negateCt(k2neg, k2p);
    return k1p.add(k2p);
  }
  /**
   * Projective Point works in 3d / projective (homogeneous) coordinates:(X, Y, Z) ∋ (x=X/Z, y=Y/Z).
   * Default Point works in 2d / affine coordinates: (x, y).
   * We're doing calculations in projective, because its operations don't require costly inversion.
   */
  class Point {
    // base / generator point
    static BASE = new Point(CURVE.Gx, CURVE.Gy, Fp.ONE);
    // zero / infinity / identity point
    static ZERO = new Point(Fp.ZERO, Fp.ONE, Fp.ZERO); // 0, 1, 0
    // math field
    static Fp = Fp;
    // scalar field
    static Fn = Fn;
    X;
    Y;
    Z;
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    constructor(X, Y, Z) {
      this.X = acoord("x", X);
      // This is not just about ZERO / infinity: ambient curves can have real
      // finite points with y=0. Those points are 2-torsion, so they cannot lie
      // in the odd prime-order subgroups this point type is meant to represent.
      this.Y = acoord("y", Y, true);
      this.Z = acoord("z", Z);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp.isValid(x) || !Fp.isValid(y)) throw new Error("invalid affine point");
      if (p instanceof Point) throw new Error("projective point not allowed");
      // (0, 0) would've produced (0, 0, 1) - instead, we need (0, 1, 0)
      if (Fp.is0(x) && Fp.is0(y)) return Point.ZERO;
      return new Point(x, y, Fp.ONE);
    }
    static fromBytes(bytes) {
      const P = Point.fromAffine(decodePoint(abytes(bytes, undefined, "point")));
      P.assertValidity();
      return P;
    }
    static fromHex(hex) {
      return Point.fromBytes(hexToBytes(hex));
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    /**
     *
     * @param windowSize
     * @param isLazy - true will defer table computation until the first multiplication
     * @returns
     */
    precompute(windowSize = 8, isLazy = true) {
      wnaf.createCache(this, windowSize);
      if (!isLazy) this.multiply(_3n); // random number
      return this;
    }
    // TODO: return `this`
    /** A point on curve is valid if it conforms to equation. */
    assertValidity() {
      const p = this;
      if (p.is0()) {
        // (0, 1, 0) aka ZERO is invalid in most contexts.
        // In BLS, ZERO can be serialized, so we allow it.
        // Keep the accepted infinity encoding canonical: projective-equivalent (X, Y, 0) points
        // like (1, 1, 0) compare equal to ZERO, but only (0, 1, 0) should pass this guard.
        if (extraOpts.allowInfinityPoint && Fp.is0(p.X) && Fp.eql(p.Y, Fp.ONE) && Fp.is0(p.Z)) return;
        throw new Error("bad point: ZERO");
      }
      // Some 3rd-party test vectors require different wording between here & `fromCompressedHex`
      const { x, y } = p.toAffine();
      if (!Fp.isValid(x) || !Fp.isValid(y)) throw new Error("bad point: x or y not field elements");
      if (!isValidXY(x, y)) throw new Error("bad point: equation left != right");
      if (!p.isTorsionFree()) throw new Error("bad point: not in prime-order subgroup");
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (!Fp.isOdd) throw new Error("Field doesn't support isOdd");
      return !Fp.isOdd(y);
    }
    /** Compare one point to another. */
    equals(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
      const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
      return U1 && U2;
    }
    /** Flips point to one corresponding to (x, -y) in Affine coordinates. */
    negate() {
      return new Point(this.X, Fp.neg(this.Y), this.Z);
    }
    // Renes-Costello-Batina exception-free doubling formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 3
    // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
    double() {
      const { a, b } = CURVE;
      const b3 = Fp.mul(b, _3n);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO; // prettier-ignore
      let t0 = Fp.mul(X1, X1); // step 1
      let t1 = Fp.mul(Y1, Y1);
      let t2 = Fp.mul(Z1, Z1);
      let t3 = Fp.mul(X1, Y1);
      t3 = Fp.add(t3, t3); // step 5
      Z3 = Fp.mul(X1, Z1);
      Z3 = Fp.add(Z3, Z3);
      X3 = Fp.mul(a, Z3);
      Y3 = Fp.mul(b3, t2);
      Y3 = Fp.add(X3, Y3); // step 10
      X3 = Fp.sub(t1, Y3);
      Y3 = Fp.add(t1, Y3);
      Y3 = Fp.mul(X3, Y3);
      X3 = Fp.mul(t3, X3);
      Z3 = Fp.mul(b3, Z3); // step 15
      t2 = Fp.mul(a, t2);
      t3 = Fp.sub(t0, t2);
      t3 = Fp.mul(a, t3);
      t3 = Fp.add(t3, Z3);
      Z3 = Fp.add(t0, t0); // step 20
      t0 = Fp.add(Z3, t0);
      t0 = Fp.add(t0, t2);
      t0 = Fp.mul(t0, t3);
      Y3 = Fp.add(Y3, t0);
      t2 = Fp.mul(Y1, Z1); // step 25
      t2 = Fp.add(t2, t2);
      t0 = Fp.mul(t2, t3);
      X3 = Fp.sub(X3, t0);
      Z3 = Fp.mul(t2, t1);
      Z3 = Fp.add(Z3, Z3); // step 30
      Z3 = Fp.add(Z3, Z3);
      return new Point(X3, Y3, Z3);
    }
    // Renes-Costello-Batina exception-free addition formula.
    // There is 30% faster Jacobian formula, but it is not complete.
    // https://eprint.iacr.org/2015/1060, algorithm 1
    // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
    add(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO; // prettier-ignore
      const a = CURVE.a;
      const b3 = Fp.mul(CURVE.b, _3n);
      let t0 = Fp.mul(X1, X2); // step 1
      let t1 = Fp.mul(Y1, Y2);
      let t2 = Fp.mul(Z1, Z2);
      let t3 = Fp.add(X1, Y1);
      let t4 = Fp.add(X2, Y2); // step 5
      t3 = Fp.mul(t3, t4);
      t4 = Fp.add(t0, t1);
      t3 = Fp.sub(t3, t4);
      t4 = Fp.add(X1, Z1);
      let t5 = Fp.add(X2, Z2); // step 10
      t4 = Fp.mul(t4, t5);
      t5 = Fp.add(t0, t2);
      t4 = Fp.sub(t4, t5);
      t5 = Fp.add(Y1, Z1);
      X3 = Fp.add(Y2, Z2); // step 15
      t5 = Fp.mul(t5, X3);
      X3 = Fp.add(t1, t2);
      t5 = Fp.sub(t5, X3);
      Z3 = Fp.mul(a, t4);
      X3 = Fp.mul(b3, t2); // step 20
      Z3 = Fp.add(X3, Z3);
      X3 = Fp.sub(t1, Z3);
      Z3 = Fp.add(t1, Z3);
      Y3 = Fp.mul(X3, Z3);
      t1 = Fp.add(t0, t0); // step 25
      t1 = Fp.add(t1, t0);
      t2 = Fp.mul(a, t2);
      t4 = Fp.mul(b3, t4);
      t1 = Fp.add(t1, t2);
      t2 = Fp.sub(t0, t2); // step 30
      t2 = Fp.mul(a, t2);
      t4 = Fp.add(t4, t2);
      t0 = Fp.mul(t1, t4);
      Y3 = Fp.add(Y3, t0);
      t0 = Fp.mul(t5, t4); // step 35
      X3 = Fp.mul(t3, X3);
      X3 = Fp.sub(X3, t0);
      t0 = Fp.mul(t3, t1);
      Z3 = Fp.mul(t5, Z3);
      Z3 = Fp.add(Z3, t0); // step 40
      return new Point(X3, Y3, Z3);
    }
    subtract(other) {
      // Validate before calling `negate()` so wrong inputs fail with the point guard
      // instead of leaking a foreign `negate()` error.
      aprjpoint(other);
      return this.add(other.negate());
    }
    is0() {
      return this.equals(Point.ZERO);
    }
    /**
     * Constant time multiplication.
     * Uses wNAF method. Windowed method may be 10% faster,
     * but takes 2x longer to generate and consumes 2x memory.
     * Uses precomputes when available.
     * Uses endomorphism for Koblitz curves.
     * @param scalar - by which the point would be multiplied
     * @returns New point
     */
    multiply(scalar) {
      const { endo } = extraOpts;
      // Keep the subgroup-scalar contract strict instead of reducing 0 / n to ZERO.
      // In key/signature-style callers, those values usually mean broken hash/scalar plumbing,
      // and failing closed is safer than silently producing the identity point.
      if (!Fn.isValidNot0(scalar)) throw new RangeError("invalid scalar: out of range"); // 0 is invalid
      let point, fake; // Fake point is used to const-time mult
      const mul = (n) => wnaf.cached(this, n, (p) => normalizeZ(Point, p));
      /** See docs for {@link EndomorphismOpts} */
      if (endo) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(scalar);
        const { p: k1p, f: k1f } = mul(k1);
        const { p: k2p, f: k2f } = mul(k2);
        fake = k1f.add(k2f);
        point = finishEndo(endo.beta, k1p, k2p, k1neg, k2neg);
      } else {
        const { p, f } = mul(scalar);
        point = p;
        fake = f;
      }
      // Normalize `z` for both points, but return only real one
      return normalizeZ(Point, [point, fake])[0];
    }
    /**
     * Non-constant-time multiplication. Uses double-and-add algorithm.
     * It's faster, but should only be used when you don't care about
     * an exposed secret key e.g. sig verification, which works over *public* keys.
     */
    multiplyUnsafe(scalar) {
      const { endo } = extraOpts;
      const p = this;
      const sc = scalar;
      // Public-scalar callers may need 0, but n and larger values stay rejected here too.
      // Reducing them mod n would turn bad caller input into an accidental identity point.
      if (!Fn.isValid(sc)) throw new RangeError("invalid scalar: out of range"); // 0 is valid
      if (sc === _0n || p.is0()) return Point.ZERO; // 0
      if (sc === _1n) return p; // 1
      if (wnaf.hasCache(this)) return this.multiply(sc); // precomputes
      // We don't have method for double scalar multiplication (aP + bQ):
      // Even with using Strauss-Shamir trick, it's 35% slower than naïve mul+add.
      if (endo) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(sc);
        const { p1, p2 } = mulEndoUnsafe(Point, p, k1, k2); // 30% faster vs wnaf.unsafe
        return finishEndo(endo.beta, p1, p2, k1neg, k2neg);
      } else {
        return wnaf.unsafe(p, sc);
      }
    }
    /**
     * Converts Projective point to affine (x, y) coordinates.
     * (X, Y, Z) ∋ (x=X/Z, y=Y/Z).
     * @param invertedZ - Z^-1 (inverted zero) - optional, precomputation is useful for invertBatch
     */
    toAffine(invertedZ) {
      const p = this;
      let iz = invertedZ;
      const { X, Y, Z } = p;
      // Fast-path for normalized points
      if (Fp.eql(Z, Fp.ONE)) return { x: X, y: Y };
      const is0 = p.is0();
      // If invZ was 0, we return zero point. However we still want to execute
      // all operations, so we replace invZ with a random number, 1.
      if (iz == null) iz = is0 ? Fp.ONE : Fp.inv(Z);
      const x = Fp.mul(X, iz);
      const y = Fp.mul(Y, iz);
      const zz = Fp.mul(Z, iz);
      if (is0) return { x: Fp.ZERO, y: Fp.ZERO };
      if (!Fp.eql(zz, Fp.ONE)) throw new Error("invZ was invalid");
      return { x, y };
    }
    /**
     * Checks whether Point is free of torsion elements (is in prime subgroup).
     * Always torsion-free for cofactor=1 curves.
     */
    isTorsionFree() {
      const { isTorsionFree } = extraOpts;
      if (cofactor === _1n) return true;
      if (isTorsionFree) return isTorsionFree(Point, this);
      return wnaf.unsafe(this, CURVE_ORDER).is0();
    }
    clearCofactor() {
      const { clearCofactor } = extraOpts;
      if (cofactor === _1n) return this; // Fast-path
      if (clearCofactor) return clearCofactor(Point, this);
      // Default fallback assumes the cofactor fits the usual subgroup-scalar
      // multiplyUnsafe() contract. Curves with larger / structured cofactors
      // should define a clearCofactor override anyway (e.g. psi/Frobenius maps).
      return this.multiplyUnsafe(cofactor);
    }
    isSmallOrder() {
      if (cofactor === _1n) return this.is0(); // Fast-path
      return this.clearCofactor().is0();
    }
    toBytes(isCompressed = true) {
      abool(isCompressed, "isCompressed");
      // Same policy as pointFromBytes(): keep ZERO out of the default byte surface because
      // callers use these encodings as public keys, where SEC 1 validation rejects infinity.
      this.assertValidity();
      return encodePoint(Point, this, isCompressed);
    }
    toHex(isCompressed = true) {
      return bytesToHex(this.toBytes(isCompressed));
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
  }
  const bits = Fn.BITS;
  const wnaf = new wNAF(Point, extraOpts.endo ? Math.ceil(bits / 2) : bits);
  // Tiny toy curves can have scalar fields narrower than 8 bits. Skip the
  // eager W=8 cache there instead of rejecting an otherwise valid constructor.
  if (bits >= 8) Point.BASE.precompute(8); // Enable precomputes. Slows down first publicKey computation by 20ms.
  Object.freeze(Point.prototype);
  Object.freeze(Point);
  return Point;
}
// Points start with byte 0x02 when y is even; otherwise 0x03
function pprefix(hasEvenY) {
  return Uint8Array.of(hasEvenY ? 0x02 : 0x03);
}
function getWLengths(Fp, Fn) {
  return {
    secretKey: Fn.BYTES,
    publicKey: 1 + Fp.BYTES,
    publicKeyUncompressed: 1 + 2 * Fp.BYTES,
    publicKeyHasPrefix: true,
    // Raw compact `(r || s)` signature width; DER and recovered signatures use
    // different lengths outside this helper.
    signature: 2 * Fn.BYTES,
  };
}
/**
 * Sometimes users only need getPublicKey, getSharedSecret, and secret key handling.
 * This helper ensures no signature functionality is present. Less code, smaller bundle size.
 * @param Point - Weierstrass point constructor.
 * @param ecdhOpts - Optional randomness helpers:
 *   - `randomBytes` (optional): Optional RNG override.
 * @returns ECDH helper namespace.
 * @example
 * Sometimes users only need getPublicKey, getSharedSecret, and secret key handling.
 *
 * ```ts
 * import { ecdh } from '@noble/curves/abstract/weierstrass.js';
 * import { p256 } from '@noble/curves/nist.js';
 * const dh = ecdh(p256.Point);
 * const alice = dh.keygen();
 * const shared = dh.getSharedSecret(alice.secretKey, alice.publicKey);
 * ```
 */
function ecdh(Point, ecdhOpts = {}) {
  const { Fn } = Point;
  const randomBytes_ = ecdhOpts.randomBytes === undefined ? randomBytes : ecdhOpts.randomBytes;
  // Keep the advertised seed length aligned with mapHashToField(), which keeps a hard 16-byte
  // minimum even on toy curves.
  const lengths = Object.assign(getWLengths(Point.Fp, Fn), {
    seed: Math.max(getMinHashLength(Fn.ORDER), 16),
  });
  function isValidSecretKey(secretKey) {
    try {
      const num = Fn.fromBytes(secretKey);
      return Fn.isValidNot0(num);
    } catch (error) {
      return false;
    }
  }
  function isValidPublicKey(publicKey, isCompressed) {
    const { publicKey: comp, publicKeyUncompressed } = lengths;
    try {
      const l = publicKey.length;
      if (isCompressed === true && l !== comp) return false;
      if (isCompressed === false && l !== publicKeyUncompressed) return false;
      return !!Point.fromBytes(publicKey);
    } catch (error) {
      return false;
    }
  }
  /**
   * Produces cryptographically secure secret key from random of size
   * (groupLen + ceil(groupLen / 2)) with modulo bias being negligible.
   */
  function randomSecretKey(seed) {
    seed = seed === undefined ? randomBytes_(lengths.seed) : seed;
    return mapHashToField(abytes(seed, lengths.seed, "seed"), Fn.ORDER);
  }
  /**
   * Computes public key for a secret key. Checks for validity of the secret key.
   * @param isCompressed - whether to return compact (default), or full key
   * @returns Public key, full when isCompressed=false; short when isCompressed=true
   */
  function getPublicKey(secretKey, isCompressed = true) {
    return Point.BASE.multiply(Fn.fromBytes(secretKey)).toBytes(isCompressed);
  }
  /**
   * Quick and dirty check for item being public key. Does not validate hex, or being on-curve.
   */
  function isProbPub(item) {
    const { secretKey, publicKey, publicKeyUncompressed } = lengths;
    const allowedLengths = Fn._lengths;
    if (!isBytes(item)) return undefined;
    const l = abytes(item, undefined, "key").length;
    const isPub = l === publicKey || l === publicKeyUncompressed;
    const isSec = l === secretKey || !!allowedLengths?.includes(l);
    // P-521 accepts both 65- and 66-byte secret keys, so overlapping lengths stay ambiguous.
    if (isPub && isSec) return undefined;
    return isPub;
  }
  /**
   * ECDH (Elliptic Curve Diffie Hellman).
   * Computes encoded shared point from secret key A and public key B.
   * Checks: 1) secret key validity 2) shared key is on-curve.
   * Does NOT hash the result or expose the SEC 1 x-coordinate-only `z`.
   * Returns the encoded shared point on purpose: callers that need `x_P`
   * can derive it from the encoded point, but `x_P` alone cannot recover the
   * point/parity back.
   * This helper only exposes the fully validated public-key path, not cofactor DH.
   * @param isCompressed - whether to return compact (default), or full key
   * @returns shared point encoding
   */
  function getSharedSecret(secretKeyA, publicKeyB, isCompressed = true) {
    if (isProbPub(secretKeyA) === true) throw new Error("first arg must be private key");
    if (isProbPub(publicKeyB) === false) throw new Error("second arg must be public key");
    const s = Fn.fromBytes(secretKeyA);
    const b = Point.fromBytes(publicKeyB); // checks for being on-curve
    return b.multiply(s).toBytes(isCompressed);
  }
  const utils = {
    isValidSecretKey,
    isValidPublicKey,
    randomSecretKey,
  };
  const keygen = createKeygen(randomSecretKey, getPublicKey);
  Object.freeze(utils);
  Object.freeze(lengths);
  return Object.freeze({ getPublicKey, getSharedSecret, keygen, Point, utils, lengths });
}
/**
 * Creates ECDSA signing interface for given elliptic curve `Point` and `hash` function.
 *
 * @param Point - created using {@link weierstrass} function
 * @param hash - used for 1) message prehash-ing 2) k generation in `sign`, using hmac_drbg(hash)
 * @param ecdsaOpts - rarely needed, see {@link ECDSAOpts}:
 *   - `lowS`: Default low-S policy.
 *   - `hmac`: HMAC implementation used by RFC6979 DRBG.
 *   - `randomBytes`: Optional RNG override.
 *   - `bits2int`: Optional hash-to-int conversion override.
 *   - `bits2int_modN`: Optional hash-to-int-mod-n conversion override.
 *
 * @returns ECDSA helper namespace.
 * @example
 * Create an ECDSA signer/verifier bundle for one curve implementation.
 *
 * ```ts
 * import { ecdsa } from '@noble/curves/abstract/weierstrass.js';
 * import { p256 } from '@noble/curves/nist.js';
 * import { sha256 } from '@noble/hashes/sha2.js';
 * const p256ecdsa = ecdsa(p256.Point, sha256);
 * const { secretKey, publicKey } = p256ecdsa.keygen();
 * const msg = new TextEncoder().encode('hello noble');
 * const sig = p256ecdsa.sign(msg, secretKey);
 * const isValid = p256ecdsa.verify(sig, msg, publicKey);
 * ```
 */
function ecdsa(Point, hash, ecdsaOpts = {}) {
  // Custom hash / bits2int hooks are treated as pure functions over validated caller-owned bytes.
  const hash_ = hash;
  ahash(hash_);
  validateObject(
    ecdsaOpts,
    {},
    {
      hmac: "function",
      lowS: "boolean",
      randomBytes: "function",
      bits2int: "function",
      bits2int_modN: "function",
    }
  );
  ecdsaOpts = Object.assign({}, ecdsaOpts);
  const randomBytes$1 = ecdsaOpts.randomBytes === undefined ? randomBytes : ecdsaOpts.randomBytes;
  const hmac$1 = ecdsaOpts.hmac === undefined ? (key, msg) => hmac(hash_, key, msg) : ecdsaOpts.hmac;
  const { Fp, Fn } = Point;
  const { ORDER: CURVE_ORDER, BITS: fnBits } = Fn;
  const { keygen, getPublicKey, getSharedSecret, utils, lengths } = ecdh(Point, ecdsaOpts);
  const defaultSigOpts = {
    prehash: true,
    lowS: typeof ecdsaOpts.lowS === "boolean" ? ecdsaOpts.lowS : true,
    format: "compact",
    extraEntropy: false,
  };
  // SEC 1 4.1.6 public-key recovery tries x = r + jn for j = 0..h. Our recovered-signature
  // format only stores one overflow bit, so it can only distinguish q.x = r from q.x = r + n.
  // A third lift would have the form q.x = r + 2n. Since valid ECDSA r is in 1..n-1, the
  // smallest such lift is 1 + 2n, not 2n.
  const hasLargeRecoveryLifts = CURVE_ORDER * _2n + _1n < Fp.ORDER;
  function isBiggerThanHalfOrder(number) {
    const HALF = CURVE_ORDER >> _1n;
    return number > HALF;
  }
  function validateRS(title, num) {
    if (!Fn.isValidNot0(num)) throw new Error(`invalid signature ${title}: out of range 1..Point.Fn.ORDER`);
    return num;
  }
  function assertRecoverableCurve() {
    // ECDSA recovery only supports curves where the current recovery id can distinguish
    // q.x = r and q.x = r + n; larger lifts may need additional `r + n*i` branches.
    // SEC 1 4.1.6 recovers candidates via x = r + jn, but this format only encodes j = 0 or 1.
    // The next possible candidate is q.x = r + 2n, and its smallest valid value is 1 + 2n.
    // To easily get i, we either need to:
    // a. increase amount of valid recid values (4, 5...); OR
    // b. prohibit recovered signatures for those curves.
    if (hasLargeRecoveryLifts) throw new Error('"recovered" sig type is not supported for cofactor >2 curves');
  }
  function validateSigLength(bytes, format) {
    validateSigFormat(format);
    const size = lengths.signature;
    const sizer = format === "compact" ? size : format === "recovered" ? size + 1 : undefined;
    return abytes(bytes, sizer);
  }
  /**
   * ECDSA signature with its (r, s) properties. Supports compact, recovered & DER representations.
   */
  class Signature {
    r;
    s;
    recovery;
    constructor(r, s, recovery) {
      this.r = validateRS("r", r); // r in [1..N-1];
      this.s = validateRS("s", s); // s in [1..N-1];
      if (recovery != null) {
        assertRecoverableCurve();
        if (![0, 1, 2, 3].includes(recovery)) throw new Error("invalid recovery id");
        this.recovery = recovery;
      }
      Object.freeze(this);
    }
    static fromBytes(bytes, format = defaultSigOpts.format) {
      validateSigLength(bytes, format);
      let recid;
      if (format === "der") {
        const { r, s } = DER.toSig(abytes(bytes));
        return new Signature(r, s);
      }
      if (format === "recovered") {
        recid = bytes[0];
        format = "compact";
        bytes = bytes.subarray(1);
      }
      const L = lengths.signature / 2;
      const r = bytes.subarray(0, L);
      const s = bytes.subarray(L, L * 2);
      return new Signature(Fn.fromBytes(r), Fn.fromBytes(s), recid);
    }
    static fromHex(hex, format) {
      return this.fromBytes(hexToBytes(hex), format);
    }
    assertRecovery() {
      const { recovery } = this;
      if (recovery == null) throw new Error("invalid recovery id: must be present");
      return recovery;
    }
    addRecoveryBit(recovery) {
      return new Signature(this.r, this.s, recovery);
    }
    // Unlike the top-level helper below, this method expects a digest that has
    // already been hashed to the curve's message representative.
    recoverPublicKey(messageHash) {
      const { r, s } = this;
      const recovery = this.assertRecovery();
      const radj = recovery === 2 || recovery === 3 ? r + CURVE_ORDER : r;
      if (!Fp.isValid(radj)) throw new Error("invalid recovery id: sig.r+curve.n != R.x");
      const x = Fp.toBytes(radj);
      const R = Point.fromBytes(concatBytes(pprefix((recovery & 1) === 0), x));
      const ir = Fn.inv(radj); // r^-1
      const h = bits2int_modN(abytes(messageHash, undefined, "msgHash")); // Truncate hash
      const u1 = Fn.create(-h * ir); // -hr^-1
      const u2 = Fn.create(s * ir); // sr^-1
      // (sr^-1)R-(hr^-1)G = -(hr^-1)G + (sr^-1). unsafe is fine: there is no private data.
      const Q = Point.BASE.multiplyUnsafe(u1).add(R.multiplyUnsafe(u2));
      if (Q.is0()) throw new Error("invalid recovery: point at infinify");
      Q.assertValidity();
      return Q;
    }
    // Signatures should be low-s, to prevent malleability.
    hasHighS() {
      return isBiggerThanHalfOrder(this.s);
    }
    toBytes(format = defaultSigOpts.format) {
      validateSigFormat(format);
      if (format === "der") return hexToBytes(DER.hexFromSig(this));
      const { r, s } = this;
      const rb = Fn.toBytes(r);
      const sb = Fn.toBytes(s);
      if (format === "recovered") {
        assertRecoverableCurve();
        return concatBytes(Uint8Array.of(this.assertRecovery()), rb, sb);
      }
      return concatBytes(rb, sb);
    }
    toHex(format) {
      return bytesToHex(this.toBytes(format));
    }
  }
  Object.freeze(Signature.prototype);
  Object.freeze(Signature);
  // RFC6979: ensure ECDSA msg is X bytes and < N. RFC suggests optional truncating via bits2octets.
  // FIPS 186-4 4.6 suggests the leftmost min(nBitLen, outLen) bits, which matches bits2int.
  // bits2int can produce res>N, we can do mod(res, N) since the bitLen is the same.
  // int2octets can't be used; pads small msgs with 0: unacceptatble for trunc as per RFC vectors
  const bits2int =
    ecdsaOpts.bits2int === undefined
      ? function bits2int_def(bytes) {
          // Our custom check "just in case", for protection against DoS
          if (bytes.length > 8192) throw new Error("input is too large");
          // For curves with nBitLength % 8 !== 0: bits2octets(bits2octets(m)) !== bits2octets(m)
          // for some cases, since bytes.length * 8 is not actual bitLength.
          const num = bytesToNumberBE(bytes); // check for == u8 done here
          const delta = bytes.length * 8 - fnBits; // truncate to nBitLength leftmost bits
          return delta > 0 ? num >> BigInt(delta) : num;
        }
      : ecdsaOpts.bits2int;
  const bits2int_modN =
    ecdsaOpts.bits2int_modN === undefined
      ? function bits2int_modN_def(bytes) {
          return Fn.create(bits2int(bytes)); // can't use bytesToNumberBE here
        }
      : ecdsaOpts.bits2int_modN;
  const ORDER_MASK = bitMask(fnBits);
  // Pads output with zero as per spec.
  /** Converts to bytes. Checks if num in `[0..ORDER_MASK-1]` e.g.: `[0..2^256-1]`. */
  function int2octets(num) {
    aInRange("num < 2^" + fnBits, num, _0n, ORDER_MASK);
    return Fn.toBytes(num);
  }
  function validateMsgAndHash(message, prehash) {
    abytes(message, undefined, "message");
    return prehash ? abytes(hash_(message), undefined, "prehashed message") : message;
  }
  /**
   * Steps A, D of RFC6979 3.2.
   * Creates RFC6979 seed; converts msg/privKey to numbers.
   * Used only in sign, not in verify.
   *
   * Warning: we cannot assume here that message has same amount of bytes as curve order,
   * this will be invalid at least for P521. Also it can be bigger for P224 + SHA256.
   */
  function prepSig(message, secretKey, opts) {
    const { lowS, prehash, extraEntropy } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash); // RFC6979 3.2 A: h1 = H(m)
    // We can't later call bits2octets, since nested bits2int is broken for curves
    // with fnBits % 8 !== 0. Because of that, we unwrap it here as int2octets call.
    // const bits2octets = (bits) => int2octets(bits2int_modN(bits))
    const h1int = bits2int_modN(message);
    const d = Fn.fromBytes(secretKey); // validate secret key, convert to bigint
    if (!Fn.isValidNot0(d)) throw new Error("invalid private key");
    const seedArgs = [int2octets(d), int2octets(h1int)];
    // extraEntropy. RFC6979 3.6: additional k' (optional).
    if (extraEntropy != null && extraEntropy !== false) {
      // K = HMAC_K(V || 0x00 || int2octets(x) || bits2octets(h1) || k')
      // gen random bytes OR pass as-is
      const e = extraEntropy === true ? randomBytes$1(lengths.secretKey) : extraEntropy;
      seedArgs.push(abytes(e, undefined, "extraEntropy")); // check for being bytes
    }
    const seed = concatBytes(...seedArgs); // Step D of RFC6979 3.2
    const m = h1int; // no need to call bits2int second time here, it is inside truncateHash!
    // Converts signature params into point w r/s, checks result for validity.
    // To transform k => Signature:
    // q = k⋅G
    // r = q.x mod n
    // s = k^-1(m + rd) mod n
    // Can use scalar blinding b^-1(bm + bdr) where b ∈ [1,q−1] according to
    // https://tches.iacr.org/index.php/TCHES/article/view/7337/6509. We've decided against it:
    // a) dependency on CSPRNG b) 15% slowdown c) doesn't really help since bigints are not CT
    function k2sig(kBytes) {
      // RFC 6979 Section 3.2, step 3: k = bits2int(T)
      // Important: all mod() calls here must be done over N
      const k = bits2int(kBytes); // Cannot use fields methods, since it is group element
      if (!Fn.isValidNot0(k)) return; // Valid scalars (including k) must be in 1..N-1
      const ik = Fn.inv(k); // k^-1 mod n
      const q = Point.BASE.multiply(k).toAffine(); // q = k⋅G
      const r = Fn.create(q.x); // r = q.x mod n
      if (r === _0n) return;
      const s = Fn.create(ik * Fn.create(m + r * d)); // s = k^-1(m + rd) mod n
      if (s === _0n) return;
      let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n); // recovery bit (2 or 3 when q.x>n)
      let normS = s;
      if (lowS && isBiggerThanHalfOrder(s)) {
        normS = Fn.neg(s); // if lowS was passed, ensure s is always in the bottom half of N
        recovery ^= 1;
      }
      return new Signature(r, normS, hasLargeRecoveryLifts ? undefined : recovery);
    }
    return { seed, k2sig };
  }
  /**
   * Signs a message or message hash with a secret key.
   * With the default `prehash: true`, raw message bytes are hashed internally;
   * only `{ prehash: false }` expects a caller-supplied digest.
   *
   * ```
   * sign(m, d) where
   *   k = rfc6979_hmac_drbg(m, d)
   *   (x, y) = G × k
   *   r = x mod n
   *   s = (m + dr) / k mod n
   * ```
   */
  function sign(message, secretKey, opts = {}) {
    const { seed, k2sig } = prepSig(message, secretKey, opts); // Steps A, D of RFC6979 3.2.
    const drbg = createHmacDrbg(hash_.outputLen, Fn.BYTES, hmac$1);
    const sig = drbg(seed, k2sig); // Steps B, C, D, E, F, G
    return sig.toBytes(opts.format);
  }
  /**
   * Verifies a signature against message and public key.
   * Rejects lowS signatures by default: see {@link ECDSAVerifyOpts}.
   * Implements section 4.1.4 from https://www.secg.org/sec1-v2.pdf:
   *
   * ```
   * verify(r, s, h, P) where
   *   u1 = hs^-1 mod n
   *   u2 = rs^-1 mod n
   *   R = u1⋅G + u2⋅P
   *   mod(R.x, n) == r
   * ```
   */
  function verify(signature, message, publicKey, opts = {}) {
    const { lowS, prehash, format } = validateSigOpts(opts, defaultSigOpts);
    publicKey = abytes(publicKey, undefined, "publicKey");
    message = validateMsgAndHash(message, prehash);
    if (!isBytes(signature)) {
      const end = signature instanceof Signature ? ", use sig.toBytes()" : "";
      throw new Error("verify expects Uint8Array signature" + end);
    }
    validateSigLength(signature, format); // execute this twice because we want loud error
    try {
      const sig = Signature.fromBytes(signature, format);
      const P = Point.fromBytes(publicKey);
      if (lowS && sig.hasHighS()) return false;
      const { r, s } = sig;
      const h = bits2int_modN(message); // mod n, not mod p
      const is = Fn.inv(s); // s^-1 mod n
      const u1 = Fn.create(h * is); // u1 = hs^-1 mod n
      const u2 = Fn.create(r * is); // u2 = rs^-1 mod n
      const R = Point.BASE.multiplyUnsafe(u1).add(P.multiplyUnsafe(u2)); // u1⋅G + u2⋅P
      if (R.is0()) return false;
      const v = Fn.create(R.x); // v = r.x mod n
      return v === r;
    } catch (e) {
      return false;
    }
  }
  function recoverPublicKey(signature, message, opts = {}) {
    // Top-level recovery mirrors `sign()` / `verify()`: it hashes raw message
    // bytes first unless the caller passes `{ prehash: false }`.
    const { prehash } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    return Signature.fromBytes(signature, "recovered").recoverPublicKey(message).toBytes();
  }
  return Object.freeze({
    keygen,
    getPublicKey,
    getSharedSecret,
    utils,
    lengths,
    Point,
    sign,
    verify,
    recoverPublicKey,
    Signature,
    hash: hash_,
  });
}

/**
 * Internal module for NIST P256, P384, P521 curves.
 * Do not use for now.
 * @module
 */
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
// p = 2n**224n * (2n**32n-1n) + 2n**192n + 2n**96n - 1n
// a = Fp256.create(BigInt('-3'));
const p256_CURVE = /* @__PURE__ */ (() => ({
  p: BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff"),
  n: BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"),
  h: BigInt(1),
  a: BigInt("0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc"),
  b: BigInt("0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b"),
  Gx: BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"),
  Gy: BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"),
}))();
// NIST P256
const p256_Point = /* @__PURE__ */ weierstrass(p256_CURVE);
/**
 * NIST P256 (aka secp256r1, prime256v1) curve, ECDSA and ECDH methods.
 * Hashes inputs with sha256 by default.
 *
 * @example
 * Generate one P-256 keypair, sign a message, and verify it.
 *
 * ```js
 * import { p256 } from '@noble/curves/nist.js';
 * const { secretKey, publicKey } = p256.keygen();
 * // const publicKey = p256.getPublicKey(secretKey);
 * const msg = new TextEncoder().encode('hello noble');
 * const sig = p256.sign(msg, secretKey);
 * const isValid = p256.verify(sig, msg, publicKey);
 * // const sigKeccak = p256.sign(keccak256(msg), secretKey, { prehash: false });
 * ```
 */
const p256 = /* @__PURE__ */ ecdsa(p256_Point, sha256);

/**
 * Compatibility wrapper matching the elliptic.js Ec interface used by SignatureV4a.
 * Provides: new Ec("p256").keyFromPrivate(key).sign(hash).toDER()
 */
class Ec {
  constructor(curve) {
    if (curve !== "p256") throw new Error(`Unsupported curve: ${curve}`);
  }

  keyFromPrivate(privateKey) {
    return {
      sign(hash) {
        const sig = p256.sign(hash, privateKey, { prehash: false, format: "der" });
        return {
          toDER() {
            return sig;
          },
        };
      },
    };
  }
}

export { Ec };
