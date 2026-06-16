import { nv } from "@smithy/core/serde";

import {
  alloc,
  extendedFloat16,
  extendedFloat32,
  extendedFloat64,
  extendedOneByte,
  majorList,
  majorMap,
  majorNegativeInt64,
  majorTag,
  majorUint64,
  majorUnstructuredByteString,
  majorUtf8String,
  minorIndefinite,
  specialFalse,
  specialNull,
  specialTrue,
  specialUndefined,
  tag,
  type CborArgumentLength,
  type CborArgumentLengthOffset,
  type CborListType,
  type CborMapType,
  type CborOffset,
  type CborUnstructuredByteStringType,
  type CborValueType,
  type Float32,
  type Uint8,
  type Uint32,
  type Uint64,
} from "./cbor-types";

const USE_BUFFER = typeof Buffer !== "undefined";
const textDecoder = new TextDecoder();

let payload = alloc(0);
let isBuffer = false;
let dataView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

/**
 * This number stores the last offset of any decoded segment.
 */
let _offset: CborOffset = 0;

/**
 * Sets the decode bytearray source and its data view.
 *
 * @internal
 * @param bytes - to be set as the decode source.
 */
export function setPayload(bytes: Uint8Array) {
  payload = bytes;
  isBuffer = USE_BUFFER && payload instanceof Buffer;
  dataView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
}

/**
 * Decodes the data between the two indices.
 *
 * @internal
 */
export function decode(at: Uint32, to: Uint32): CborValueType {
  if (at >= to) {
    throw new Error("unexpected end of (decode) payload.");
  }

  const major = (payload[at] & 0b1110_0000) >> 5;
  const minor = payload[at] & 0b0001_1111;

  if (minor === minorIndefinite && 2 <= major && major <= 5) {
    return decodeIndefinite(at, to);
  }

  switch (major) {
    case majorUint64:
    case majorNegativeInt64:
    case majorTag: {
      let unsignedInt: number | Uint64;
      let offset: number;

      if (minor < 24) {
        unsignedInt = minor;
        offset = 1 satisfies CborArgumentLengthOffset;
      } else {
        switch (minor) {
          case extendedOneByte:
            if (to - at < (2 satisfies CborArgumentLengthOffset)) {
              overflow(1);
            }
            unsignedInt = payload[at + 1];
            offset = 2 satisfies CborArgumentLengthOffset;
            break;
          case extendedFloat16:
            if (to - at < (3 satisfies CborArgumentLengthOffset)) {
              overflow(2);
            }
            unsignedInt = dataView.getUint16(at + 1);
            offset = 3 satisfies CborArgumentLengthOffset;
            break;
          case extendedFloat32:
            if (to - at < (5 satisfies CborArgumentLengthOffset)) {
              overflow(4);
            }
            unsignedInt = dataView.getUint32(at + 1);
            offset = 5 satisfies CborArgumentLengthOffset;
            break;
          case extendedFloat64:
            if (to - at < (9 satisfies CborArgumentLengthOffset)) {
              overflow(8);
            }
            // Avoid BigInt allocation when value fits in safe integer range (< 2^53).
            {
              const hi = dataView.getUint32(at + 1);
              if (hi < 0x00200000) {
                unsignedInt = hi * 4294967296 /** 2^32 */ + dataView.getUint32(at + 5);
              } else {
                unsignedInt = dataView.getBigUint64(at + 1);
              }
            }
            offset = 9 satisfies CborArgumentLengthOffset;
            break;
          default:
            unexpectedMinor(minor);
        }
      }

      if (major === majorUint64) {
        _offset = offset;
        return castBigInt(unsignedInt);
      } else if (major === majorNegativeInt64) {
        let negativeInt: bigint | number;
        if (typeof unsignedInt === "bigint") {
          negativeInt = BigInt(-1) - unsignedInt;
        } else {
          negativeInt = -1 - unsignedInt;
        }
        _offset = offset;
        return castBigInt(negativeInt);
      } else {
        /* major === majorTag */
        return decodeTagValue(at, to, minor, unsignedInt, offset);
      }
    }
    case majorUtf8String:
      return decodeUtf8String(at, to);
    case majorMap:
      return decodeMap(at, to);
    case majorList:
      return decodeList(at, to);
    case majorUnstructuredByteString:
      return decodeUnstructuredByteString(at, to);
    default:
      return decodeSpecial(at, to);
  }
}

function decodeIndefinite(at: Uint32, to: Uint32): CborValueType {
  const major = (payload[at] & 0b1110_0000) >> 5;
  const minor = payload[at] & 0b0001_1111;
  if (minor === minorIndefinite) {
    switch (major) {
      case majorUtf8String:
        return decodeUtf8StringIndefinite(at, to);
      case majorMap:
        return decodeMapIndefinite(at, to);
      case majorList:
        return decodeListIndefinite(at, to);
      case majorUnstructuredByteString:
        return decodeUnstructuredByteStringIndefinite(at, to);
      default:
    }
  }
}

/**
 * @internal
 */
export function bytesToFloat16(a: Uint8, b: Uint8): Float32 {
  const sign = a >> 7;
  const exponent = (a & 0b0111_1100) >> 2;
  const fraction = ((a & 0b0000_0011) << 8) | b;

  const scalar = sign === 0 ? 1 : -1;

  if (exponent === 0b00000) {
    if (fraction === 0) {
      return 0;
    }
    return scalar * (Math.pow(2, 1 - 15) * (fraction / 1024));
  } else if (exponent === 0b11111) {
    if (fraction === 0) {
      return scalar * Infinity;
    }
    return NaN;
  }

  return scalar * (Math.pow(2, exponent - 15) * (1 + fraction / 1024));
}

/**
 * Decodes map entries. Keys must be UTF-8 strings per Smithy specification.
 */
function decodeMap(at: Uint32, to: Uint32): CborMapType {
  const mapDataLength = decodeCount(at, to);
  if (mapDataLength < 15) {
    return decodeMapSmall(at, to, mapDataLength);
  }
  return decodeMapLarge(at, to, mapDataLength);
}

/**
 * Uses Object.create(null), which assigns values faster.
 * Paid for by a single setPrototypeOf.
 */
function decodeMapLarge(at: Uint32, to: Uint32, mapDataLength: number): CborMapType {
  const offset = _offset;
  at += offset;
  const base = at;
  const map = Object.create(null) as CborMapType;
  for (let i = 0; i < mapDataLength; ++i) {
    const key = decodeUtf8String(at, to);
    at += _offset;
    const valMajor = (payload[at] & 0b1110_0000) >> 5;
    if (valMajor === majorUtf8String) {
      map[key] = decodeUtf8String(at, to);
    } else {
      map[key] = decode(at, to);
    }
    at += _offset;
  }
  _offset = offset + (at - base);
  Object.setPrototypeOf(map, Object.prototype);
  return map;
}

function decodeMapSmall(at: Uint32, to: Uint32, mapDataLength: number): CborMapType {
  const offset = _offset;
  at += offset;
  const base = at;
  const map = {} as CborMapType;
  for (let i = 0; i < mapDataLength; ++i) {
    const key = decodeUtf8String(at, to);
    at += _offset;
    map[key] = decode(at, to);
    at += _offset;
  }
  _offset = offset + (at - base);
  return map;
}

function decodeList(at: Uint32, to: Uint32): CborListType {
  const listDataLength = decodeCount(at, to);
  const offset = _offset;
  at += offset;
  const base = at;
  // perf: pre-allocate array length.
  const list = Array(listDataLength);
  for (let i = 0; i < listDataLength; ++i) {
    list[i] = decode(at, to);
    at += _offset;
  }
  _offset = offset + (at - base);
  return list;
}

function decodeUtf8String(at: Uint32, to: Uint32): string {
  const length = decodeCount(at, to);
  const offset = _offset;
  at += offset;
  if (to - at < length) {
    overflow(length);
  }
  _offset = offset + length;
  if (length < 24) {
    return decodeUtf8StringCached(at, length);
  }
  if (isBuffer) {
    return (payload as Buffer).toString("utf-8", at, at + length);
  }
  return textDecoder.decode(payload.subarray(at, at + length));
}

/**
 * For short strings (< 24 bytes), cache decoded results keyed by byte content.
 * Optimized for repeated property names in API responses.
 */
const stringCache: (string | undefined)[] = new Array(2048);
/**
 * Indicates the epoch in which the cache value at the same index was written.
 */
const stringCacheEpochs = new Uint16Array(2048);

/**
 * Global epoch indicator.
 */
let cacheEpoch = 0;

/**
 * @internal
 */
export function advanceDecodingEpoch() {
  cacheEpoch = (cacheEpoch + 1) & 0b1111_1111_1111_1111;
}

function decodeUtf8StringCached(at: number, length: number): string {
  let h = length;
  for (let i = 0; i < length; ++i) {
    h = (h * 31 + payload[at + i]) | 0;
  }
  const slot = (h >>> 0) & 2047;
  const cached = stringCache[slot];

  if (cached !== undefined) {
    if (cached.length === length) {
      let match = true;
      for (let i = 0; i < length; ++i) {
        if (cached.charCodeAt(i) !== payload[at + i]) {
          match = false;
          break;
        }
      }
      if (match) {
        stringCacheEpochs[slot] = cacheEpoch;
        return cached;
      }
    }
  }

  const result = isBuffer
    ? (payload as Buffer).toString("utf-8", at, at + length)
    : textDecoder.decode(payload.subarray(at, at + length));

  if (stringCacheEpochs[slot] !== cacheEpoch) {
    // evict collision only if inhabitant is from a previous epoch.
    stringCache[slot] = result;
    stringCacheEpochs[slot] = cacheEpoch;
  }

  return result!;
}

function decodeUnstructuredByteString(at: Uint32, to: Uint32): CborUnstructuredByteStringType {
  const length = decodeCount(at, to);
  const offset = _offset;

  at += offset;
  if (to - at < length) {
    overflow(length);
  }

  const value = payload.subarray(at, at + length);
  _offset = offset + length;
  return value;
}

function decodeTagValue(
  at: Uint32,
  to: Uint32,
  minor: number,
  unsignedInt: number | Uint64,
  offset: number
): CborValueType {
  if (minor === 2 || minor === 3) {
    const length = decodeCount(at + offset, to);

    let b = BigInt(0);
    const start = at + offset + _offset;
    for (let i = start; i < start + length; ++i) {
      b = (b << BigInt(8)) | BigInt(payload[i]);
    }
    // the new offset is the sum of:
    // 1. the local major offset (1)
    // 2. the offset of the decoded count of the bigInteger
    // 3. the length of the data bytes of the bigInteger
    _offset = offset + _offset + length;
    return minor === 3 ? -b - BigInt(1) : b;
  } else if (minor === 4) {
    const decimalFraction = decode(at + offset, to);
    const [exponent, mantissa] = decimalFraction;
    const normalizer = mantissa < 0 ? -1 : 1;
    const mantissaStr = "0".repeat(Math.abs(exponent) + 1) + String(BigInt(normalizer) * BigInt(mantissa));

    let numericString: string;
    const sign = mantissa < 0 ? "-" : "";

    numericString =
      exponent === 0
        ? mantissaStr
        : mantissaStr.slice(0, mantissaStr.length + exponent) + "." + mantissaStr.slice(exponent);
    numericString = numericString.replace(/^0+/g, "");
    if (numericString === "") {
      numericString = "0";
    }
    if (numericString[0] === ".") {
      numericString = "0" + numericString;
    }
    numericString = sign + numericString;

    // the new offset is the sum of:
    // 1. the local major offset (1)
    // 2. the offset of the decoded exponent mantissa pair
    _offset = offset + _offset;
    return nv(numericString);
  } else {
    const value = decode(at + offset, to);
    const valueOffset = _offset;

    _offset = offset + valueOffset;
    return tag({ tag: castBigInt(unsignedInt), value });
  }
}

function decodeSpecial(at: Uint32, to: Uint32): CborValueType {
  const minor = payload[at] & 0b0001_1111;
  switch (minor) {
    case specialTrue:
    case specialFalse:
      _offset = 1 satisfies CborArgumentLengthOffset;
      return minor === specialTrue;
    case specialNull:
      _offset = 1 satisfies CborArgumentLengthOffset;
      return null;
    case specialUndefined:
      // Note: the Smithy spec requires that undefined is
      // instead deserialized to null.
      _offset = 1 satisfies CborArgumentLengthOffset;
      return null;
    case extendedFloat16:
      if (to - at < (3 satisfies CborArgumentLengthOffset)) {
        throw new Error("incomplete float16 at end of buf.");
      }
      _offset = 3 satisfies CborArgumentLengthOffset;
      return bytesToFloat16(payload[at + 1], payload[at + 2]);
    case extendedFloat32:
      if (to - at < (5 satisfies CborArgumentLengthOffset)) {
        throw new Error("incomplete float32 at end of buf.");
      }
      _offset = 5 satisfies CborArgumentLengthOffset;
      return dataView.getFloat32(at + 1);
    case extendedFloat64:
      if (to - at < (9 satisfies CborArgumentLengthOffset)) {
        throw new Error("incomplete float64 at end of buf.");
      }
      _offset = 9 satisfies CborArgumentLengthOffset;
      return dataView.getFloat64(at + 1);
    default:
      unexpectedMinor(minor);
  }
}

function decodeCount(at: Uint32, to: Uint32): number {
  const minor = payload[at] & 0b0001_1111;

  if (minor < 24) {
    _offset = 1 satisfies CborArgumentLengthOffset;
    return minor;
  }

  switch (minor) {
    case extendedOneByte:
      if (to - at < (2 satisfies CborArgumentLengthOffset)) {
        overflow(1);
      }
      _offset = 2 satisfies CborArgumentLengthOffset;
      return payload[at + 1];
    case extendedFloat16:
      if (to - at < (3 satisfies CborArgumentLengthOffset)) {
        overflow(2);
      }
      _offset = 3 satisfies CborArgumentLengthOffset;
      return dataView.getUint16(at + 1);
    case extendedFloat32:
      if (to - at < (5 satisfies CborArgumentLengthOffset)) {
        overflow(4);
      }
      _offset = 5 satisfies CborArgumentLengthOffset;
      return dataView.getUint32(at + 1);
    case extendedFloat64:
      if (to - at < (9 satisfies CborArgumentLengthOffset)) {
        overflow(8);
      }
      _offset = 9 satisfies CborArgumentLengthOffset;
      return demote(dataView.getBigUint64(at + 1));
    default:
      unexpectedMinor(minor);
  }
}

function decodeMapIndefinite(at: Uint32, to: Uint32): CborMapType {
  at += 1;
  const base = at;
  const map = {} as CborMapType;
  for (; at < to; ) {
    if (payload[at] === 0b1111_1111) {
      _offset = at - base + 2;
      return map;
    }
    const key = decodeUtf8String(at, to);
    at += _offset;
    map[key] = decode(at, to);
    at += _offset;
  }
  throw new Error("expected break marker.");
}

function decodeListIndefinite(at: Uint32, to: Uint32): CborListType {
  at += 1;
  const list = [] as CborListType;
  for (const base = at; at < to; ) {
    if (payload[at] === 0b1111_1111) {
      _offset = at - base + 2;
      return list;
    }
    list.push(decode(at, to));
    at += _offset;
  }
  throw new Error("expected break marker.");
}

function decodeUtf8StringIndefinite(at: Uint32, to: Uint32): string {
  at += 1;
  const vector = [];
  for (const base = at; at < to; ) {
    if (payload[at] === 0b1111_1111) {
      const data = alloc(vector.length);
      data.set(vector, 0);
      _offset = at - base + 2;
      if (USE_BUFFER) {
        return (data as Buffer).toString("utf-8", 0, data.length);
      }
      return textDecoder.decode(data);
    }
    const major = (payload[at] & 0b1110_0000) >> 5;
    const minor = payload[at] & 0b0001_1111;
    if (major !== majorUtf8String) {
      unexpectedMajorInIndefiniteString(major);
    }
    if (minor === minorIndefinite) {
      throw new Error("nested indefinite string.");
    }
    const bytes = decodeUnstructuredByteString(at, to);
    const length = _offset;
    at += length;
    for (let i = 0; i < bytes.length; ++i) {
      vector.push(bytes[i]);
    }
  }
  throw new Error("expected break marker.");
}

function decodeUnstructuredByteStringIndefinite(at: Uint32, to: Uint32): CborUnstructuredByteStringType {
  at += 1;
  const vector = [];

  for (const base = at; at < to; ) {
    if (payload[at] === 0b1111_1111) {
      const data = alloc(vector.length);
      data.set(vector, 0);
      _offset = at - base + 2;
      return data;
    }

    const major = (payload[at] & 0b1110_0000) >> 5;
    const minor = payload[at] & 0b0001_1111;
    if (major !== majorUnstructuredByteString) {
      unexpectedMajorInIndefiniteString(major);
    }
    if (minor === minorIndefinite) {
      throw new Error("nested indefinite string.");
    }

    const bytes = decodeUnstructuredByteString(at, to);
    const length = _offset;
    at += length;
    for (let i = 0; i < bytes.length; ++i) {
      vector.push(bytes[i]);
    }
  }
  throw new Error("expected break marker.");
}

function castBigInt(bigInt: bigint | number): number | bigint {
  if (typeof bigInt === "number") {
    return bigInt;
  }
  const num = Number(bigInt);
  if (Number.MIN_SAFE_INTEGER <= num && num <= Number.MAX_SAFE_INTEGER) {
    return num;
  }
  return bigInt;
}

function demote(bigInteger: bigint): number {
  // cast is safe for string and array lengths, which do not
  // exceed safe integer range.
  const num = Number(bigInteger);
  if (num < Number.MIN_SAFE_INTEGER || Number.MAX_SAFE_INTEGER < num) {
    console.warn(new Error(`@smithy/core/cbor - truncating BigInt(${bigInteger}) to ${num} with loss of precision.`));
  }
  return num;
}

function overflow(n: number): never {
  throw new Error(`length ${n} greater than remaining buf len.`);
}

function unexpectedMinor(minor: number): never {
  throw new Error(`unexpected minor value ${minor}.`);
}

function unexpectedMajorInIndefiniteString(major: number): never {
  throw new Error(`unexpected major type ${major} in indefinite string.`);
}
