import { NumericValue } from "@smithy/core/serde";

import {
  alloc,
  extendedFloat16,
  extendedFloat32,
  extendedFloat64,
  majorList,
  majorMap,
  majorNegativeInt64,
  majorSpecial,
  majorTag,
  majorUint64,
  majorUnstructuredByteString,
  majorUtf8String,
  specialFalse,
  specialNull,
  specialTrue,
  tagSymbol,
  type CborMajorType,
  type Uint64,
} from "./cbor-types";

const USE_BUFFER = typeof Buffer !== "undefined";

/**
 * Encoder-side string cache: for short strings (≤ 23 chars),
 * caches the fully encoded CBOR bytes (header + UTF-8) to skip
 * Buffer.byteLength and Buffer.write on repeated calls.
 * Uses epoch-based eviction: stale entries are overwritten on collision.
 */
const encodeStringCache = new Map<string, { epoch: number; bytes: Uint8Array }>();
let encodeCacheEpoch: number = 0;
let encodeCacheSaturated: boolean = false;

const initialSize = 2048;
let data: Uint8Array = alloc(initialSize);
let dataView: DataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
let cursor: number = 0;

/**
 * @param _input - JS data object.
 */
export function encode(_input: any): void {
  const encodeStack: any[] = [_input];

  while (encodeStack.length) {
    const input = encodeStack.pop();

    if (typeof input === "string") {
      const len = input.length;
      if (USE_BUFFER) {
        ensureSpace(len * 3 + 9);
        if (len > 23) {
          encodeHeader(majorUtf8String, Buffer.byteLength(input));
          cursor += (data as Buffer).write(input, cursor);
        } else {
          encodeStringCached(input);
        }
      } else {
        const maxBytes = len * 3;
        ensureSpace(maxBytes + 9);
        const headerPos = cursor;
        const result = new TextEncoder().encodeInto(input, data.subarray(cursor + 9));
        const byteLen = result.written!;
        let headerSize: number;
        if (byteLen < 24) {
          headerSize = 1;
        } else if (byteLen < 256 /** 2^8 */) {
          headerSize = 2;
        } else if (byteLen < 65536 /** 2^16 */) {
          headerSize = 3;
        } else if (byteLen < 4294967296 /** 2^32 */) {
          headerSize = 5;
        } else {
          headerSize = 9;
        }
        if (headerSize < 9) {
          data.copyWithin(headerPos + headerSize, headerPos + 9, headerPos + 9 + byteLen);
        }
        cursor = headerPos;
        encodeInteger(majorUtf8String, byteLen);
        cursor += byteLen;
      }
      continue;
    }

    // Fast check: if we have at least 9 bytes, scalar encoding won't overflow.
    if (data.byteLength - cursor < 9) {
      ensureSpace(64);
    }

    if (typeof input === "number") {
      if (Number.isInteger(input)) {
        const nonNegative = input >= 0;
        const major = nonNegative ? majorUint64 : majorNegativeInt64;
        const value = nonNegative ? input : -input - 1;
        if (value < 24) {
          data[cursor++] = (major << 5) | value;
        } else if (value < 256 /** 2^8 */) {
          data[cursor++] = (major << 5) | 24;
          data[cursor++] = value;
        } else if (value < 65536 /** 2^16 */) {
          data[cursor++] = (major << 5) | extendedFloat16;
          data[cursor++] = value >> 8;
          data[cursor++] = value & 0xff;
        } else if (value < 4294967296 /** 2^32 */) {
          data[cursor++] = (major << 5) | extendedFloat32;
          dataView.setUint32(cursor, value);
          cursor += 4;
        } else {
          // Safe integer > 32 bits: manual big-endian write avoids BigInt.
          data[cursor++] = (major << 5) | extendedFloat64;
          const hi = (value / 4294967296) /** 2^32 */ | 0;
          const lo = (value - hi * 4294967296) /** 2^32 */ | 0;
          dataView.setUint32(cursor, hi);
          dataView.setUint32(cursor + 4, lo);
          cursor += 8;
        }
        continue;
      }
      data[cursor++] = (majorSpecial << 5) | extendedFloat64;
      dataView.setFloat64(cursor, input);
      cursor += 8;
      continue;
    } else if (typeof input === "bigint") {
      const nonNegative = input >= 0;
      const major = nonNegative ? majorUint64 : majorNegativeInt64;
      const value = nonNegative ? input : -input - BigInt(1);
      if (value < BigInt("18446744073709551616")) {
        const n = Number(value);
        if (n < 4294967296 /** 2^32 */) {
          encodeInteger(major, n);
        } else {
          data[cursor++] = (major << 5) | extendedFloat64;
          dataView.setBigUint64(cursor, value);
          cursor += 8;
        }
      } else {
        // refer to https://www.rfc-editor.org/rfc/rfc8949.html#name-bignums
        const binaryBigInt = value.toString(2);
        const bigIntBytes = new Uint8Array(Math.ceil(binaryBigInt.length / 8));
        let b = value;
        let i = 0;
        while (bigIntBytes.byteLength - ++i >= 0) {
          bigIntBytes[bigIntBytes.byteLength - i] = Number(b & BigInt(255));
          b >>= BigInt(8);
        }
        ensureSpace(bigIntBytes.byteLength * 2 + 16);
        data[cursor++] = nonNegative ? 0b110_00010 : 0b110_00011;
        encodeHeader(majorUnstructuredByteString, bigIntBytes.byteLength);
        data.set(bigIntBytes, cursor);
        cursor += bigIntBytes.byteLength;
      }
      continue;
    } else if (input === null) {
      data[cursor++] = (majorSpecial << 5) | specialNull;
      continue;
    } else if (typeof input === "boolean") {
      data[cursor++] = (majorSpecial << 5) | (input ? specialTrue : specialFalse);
      continue;
    } else if (typeof input === "undefined") {
      // Note: Smithy spec requires that undefined not be serialized
      // though the CBOR spec includes it.
      throw new Error("@smithy/core/cbor: client may not serialize undefined value.");
    } else if (Array.isArray(input)) {
      encodeInteger(majorList, input.length);
      // Pre-allocate space for the array items (9 bytes max per numeric item).
      ensureSpace(input.length * 9 + 64);
      for (let i = input.length - 1; i >= 0; --i) {
        encodeStack.push(input[i]);
      }
      continue;
    } else if (typeof input.byteLength === "number") {
      ensureSpace(input.length * 2 + 9);
      encodeInteger(majorUnstructuredByteString, input.length);
      data.set(input, cursor);
      cursor += input.byteLength;
      continue;
    } else if (typeof input === "object") {
      if (input instanceof NumericValue) {
        const decimalIndex = input.string.indexOf(".");
        const exponent = decimalIndex === -1 ? 0 : decimalIndex - input.string.length + 1;
        const mantissa = BigInt(input.string.replace(".", ""));

        data[cursor++] = 0b110_00100; // major 6, tag 4.
        encodeInteger(majorList, 2);
        encodeStack.push(mantissa);
        encodeStack.push(exponent);
        continue;
      }
      if (input[tagSymbol]) {
        if ("tag" in input && "value" in input) {
          encodeStack.push(input.value);
          encodeHeader(majorTag, input.tag);
          continue;
        } else {
          throw new Error(
            "tag encountered with missing fields, need 'tag' and 'value', found: " + JSON.stringify(input)
          );
        }
      }
      const keys = Object.keys(input);
      const len = keys.length;
      encodeInteger(majorMap, len);
      // Encode map keys inline, push values in reverse order for stack processing.
      // We need to process entries in order, but stack is LIFO.
      // Strategy: encode all keys now (forward), collect values, push values in reverse.
      for (let i = len - 1; i >= 0; --i) {
        encodeStack.push(input[keys[i]]);
        encodeStack.push(keys[i]);
      }
      continue;
    }

    throw new Error(`data type ${input?.constructor?.name ?? typeof input} not compatible for encoding.`);
  }
}

/**
 * @internal
 */
export function advanceEncodingEpoch() {
  encodeCacheEpoch = (encodeCacheEpoch + 1) & 0b1111_1111_1111_1111;
  encodeCacheSaturated = false;
}

/**
 * @internal
 */
export function toUint8Array(): Uint8Array {
  const out = alloc(cursor);
  out.set(data.subarray(0, cursor), 0);
  cursor = 0;
  return out;
}

export function resize(size: number) {
  const old = data;
  data = alloc(size);
  if (old) {
    if ((old as Buffer).copy) {
      (old as Buffer).copy(data, 0, 0, old.byteLength);
    } else {
      data.set(old, 0);
    }
  }
  dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
}

/**
 * Encodes a short string (≤ 23 chars) using the cache, writing
 * directly to the buffer on both hit and miss.
 */
function encodeStringCached(input: string): void {
  const cached = encodeStringCache.get(input);
  if (cached !== undefined) {
    data.set(cached.bytes, cursor);
    cursor += cached.bytes.length;
    cached.epoch = encodeCacheEpoch;
    return;
  }

  // Encode normally, then cache the result.
  const start = cursor;
  const byteLen = Buffer.byteLength(input);
  encodeInteger(majorUtf8String, byteLen);
  cursor += (data as Buffer).write(input, cursor);

  const bytes = Uint8Array.prototype.slice.call(data, start, cursor);

  // Evict stale entries if at capacity; skip if already saturated this epoch.
  if (encodeStringCache.size >= 2048) {
    if (encodeCacheSaturated) {
      return;
    }
    let evicted = 0;
    for (const [key, entry] of encodeStringCache) {
      if (evicted >= 1024) {
        break;
      }
      if (entry.epoch !== encodeCacheEpoch) {
        encodeStringCache.delete(key);
        evicted++;
      }
    }
    if (evicted === 0) {
      encodeCacheSaturated = true;
      return;
    }
  }
  if (encodeStringCache.size < 2048) {
    encodeStringCache.set(input, { epoch: encodeCacheEpoch, bytes });
  }
}

function ensureSpace(bytes: number) {
  const remaining = data.byteLength - cursor;
  if (remaining < bytes) {
    if (cursor < 16_000_000) {
      resize(Math.max(data.byteLength * 4, data.byteLength + bytes));
    } else {
      resize(data.byteLength + bytes + 16_000_000);
    }
  }
}

function encodeHeader(major: CborMajorType, value: Uint64 | number): void {
  if (value < 24) {
    data[cursor++] = (major << 5) | (value as number);
  } else if (value < 256 /** 2^8 */) {
    data[cursor++] = (major << 5) | 24;
    data[cursor++] = value as number;
  } else if (value < 65536 /** 2^16 */) {
    data[cursor++] = (major << 5) | extendedFloat16;
    dataView.setUint16(cursor, value as number);
    cursor += 2;
  } else if (value < 4294967296 /** 2^32 */) {
    data[cursor++] = (major << 5) | extendedFloat32;
    dataView.setUint32(cursor, value as number);
    cursor += 4;
  } else {
    data[cursor++] = (major << 5) | extendedFloat64;
    dataView.setBigUint64(cursor, typeof value === "bigint" ? value : BigInt(value));
    cursor += 8;
  }
}

/**
 * Encode a non-negative integer header without BigInt allocation.
 * For values up to Number.MAX_SAFE_INTEGER, avoids the BigInt path entirely.
 */
function encodeInteger(major: number, value: number): void {
  if (value < 24) {
    data[cursor++] = (major << 5) | value;
  } else if (value < 256 /** 2^8 */) {
    data[cursor++] = (major << 5) | 24;
    data[cursor++] = value;
  } else if (value < 65536 /** 2^16 */) {
    data[cursor++] = (major << 5) | extendedFloat16;
    data[cursor++] = value >> 8;
    data[cursor++] = value & 0xff;
  } else if (value < 4294967296 /** 2^32 */) {
    data[cursor++] = (major << 5) | extendedFloat32;
    dataView.setUint32(cursor, value);
    cursor += 4;
  } else {
    // Safe integer > 32 bits: manual 8-byte big-endian write avoids BigInt allocation.
    data[cursor++] = (major << 5) | extendedFloat64;
    const hi = (value / 4294967296) /** 2^32 */ | 0;
    const lo = (value - hi * 4294967296) /** 2^32 */ | 0;
    dataView.setUint32(cursor, hi);
    dataView.setUint32(cursor + 4, lo);
    cursor += 8;
  }
}
