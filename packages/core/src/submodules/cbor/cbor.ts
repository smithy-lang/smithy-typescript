import { toUtf8 } from "@smithy/util-utf8";

import { ByteVector, byteVector } from "./ByteVector";
import { decodeView } from "./DecodeView";

/**
 * This cbor serde implementation is derived from AWS SDK for Go's implementation.
 *
 * @see https://gist.github.com/lucix-aws/0b92a2d6fd80ec38ed49904e56621550
 * @see https://github.com/aws/smithy-go/tree/main/encoding/cbor
 */

/**
 *
 */
type CborItemType =
  | undefined
  | boolean
  | number
  | bigint
  | [CborUnstructuredByteStringType, Uint64]
  | string
  | CborTagType;
type CborTagType = {
  tag: Uint64 | number;
  value: CborValueType;
};
type CborUnstructuredByteStringType = Uint8Array;
type CborListType<T = any> = Array<T>;
type CborMapType<T = any> = Record<string, T>;
type CborCollectionType<T = any> = CborMapType<T> | CborListType<T>;

type CborValueType = CborItemType | CborCollectionType | any;

type CborArgumentLength = 1 | 2 | 4 | 8;
type CborArgumentLengthOffset = 1n | 2n | 3n | 5n | 9n;
type CborOffset = Uint64;

type Uint8 = number;
type Uint32 = number;
type Uint64 = bigint;

type Int64 = bigint;

type Float16Binary = number;
type Float32Binary = number;

export type CborMajorType =
  | typeof majorUint64
  | typeof majorNegativeInt64
  | typeof majorUnstructuredByteString
  | typeof majorUtf8String
  | typeof majorList
  | typeof majorMap
  | typeof majorTag
  | typeof majorSpecial;

const majorUint64 = 0; // 0b000
const majorNegativeInt64 = 1; // 0b001
const majorUnstructuredByteString = 2; // 0b010
const majorUtf8String = 3; // 0b011
const majorList = 4; // 0b100
const majorMap = 5; // 0b101
const majorTag = 6; // 0b110
const majorSpecial = 7; // 0b111

const specialFalse = 20; // 0b10100
const specialTrue = 21; // 0b10101
const specialNull = 22; // 0b10110
const specialUndefined = 23; // 0b10111
const specialOneByte = 24; // 0b11000
const specialFloat16 = 25; // 0b11001
const specialFloat32 = 26; // 0b11010
const specialFloat64 = 27; // 0b11011

const minorIndefinite = 31; // 0b11111

/**
 * Powers of 2.
 */
const TWO = {
  EIGHT: 1 << 8,
  SIXTEEN: 1 << 16,
  THIRTY_TWO: 2 ** 32,
};

/**
 * @internal
 */
function demote(bigInteger: bigint): number {
  const num = Number(bigInteger);
  if (num < Number.MIN_SAFE_INTEGER || Number.MAX_SAFE_INTEGER < num) {
    console.warn(new Error(`@smithy/core/cbor - truncating BigInt(${bigInteger}) to ${num} with loss of precision.`));
  }
  return num;
}

// decode

function float16ToUint32(float: Float16Binary): Uint32 {
  const n = [
    // sign: 2 ** 23 - 1
    (float & 0b0111_1111_1111_1111_1111_1111) << 16,
    // exponent
    (float & 0b0000_0000_0111_1100_0000_0000) >> 10,
    // mantissa: 1023
    (float & 0b0000_0000_0000_0011_1111_1111) << 13,
  ];
  const sign = n[0];
  let [exponent, mantissa] = [n[1], n[2]];

  if (exponent === 31) {
    return sign | (0b1111_1111 << 23) | mantissa;
  }

  if (exponent === 0) {
    if (mantissa === 0) return sign;

    exponent = -14 + 127;
    while ((mantissa & (1 << 23)) === 0) {
      mantissa <<= 1;
      --exponent;
    }
    mantissa &= (1 << 23) - 1;
    return sign | (exponent << 23) | mantissa;
  }

  return sign | ((exponent + 127 - 15) << 23) | mantissa;
}

function uint32ToFloat32(unsignedInt32: Uint32): Float32Binary {
  const dv = new DataView(new ArrayBuffer(4));
  dv.setInt32(0, unsignedInt32);
  return dv.getFloat32(0);
}

function peekMajor(payload: Uint8Array, at: Uint32): Uint8 {
  return (payload[at] & 0b1110_0000) >> 5;
}

function peekMinor(payload: Uint8Array, at: Uint32): Uint8 {
  return payload[at] & 0b0001_1111;
}

function decodeArgument(payload: Uint8Array, at: Uint32, to: Uint32): [Uint64, CborArgumentLengthOffset] {
  const minor = peekMinor(payload, at);
  if (minor < 24) {
    return [BigInt(minor), BigInt(1) as CborArgumentLengthOffset];
  }

  switch (minor) {
    case specialOneByte:
    case specialFloat16:
    case specialFloat32:
    case specialFloat64:
      const argLen: CborArgumentLength = minorValueToArgumentLength(minor);
      if (to - at < argLen + 1) {
        throw new Error(`arg len ${argLen} greater than remaining buf len.`);
      }

      return [readArgument(payload, at + 1, argLen), (BigInt(argLen) + BigInt(1)) as CborArgumentLengthOffset];
    default:
      throw new Error(`unexpected minor value ${minor}.`);
  }
}

function minorValueToArgumentLength(minor: number): CborArgumentLength {
  if (minor === specialOneByte) return 1;
  if (minor === specialFloat16) return 2;
  if (minor === specialFloat32) return 4;
  return 8;
}

function readArgument(payload: Uint8Array, at: Uint32, byteLength: number): Uint64 {
  if (byteLength === 1) return BigInt(payload[at]);
  if (byteLength === 2) return BigInt(decodeView.dataView.getUint16(at));
  if (byteLength === 4) return BigInt(decodeView.dataView.getUint32(at));

  return decodeView.dataView.getBigUint64(at);
}

function decodeUnsignedInt(payload: Uint8Array, at: Uint32, to: Uint32): [Uint64, CborArgumentLengthOffset] {
  return decodeArgument(payload, at, to);
}

function decodeNegativeInt(payload: Uint8Array, at: Uint32, to: Uint32): [Int64, CborArgumentLengthOffset] {
  const [i, offset] = decodeArgument(payload, at, to);
  return [-BigInt(1) - i, offset];
}

function decodeUtf8String(payload: Uint8Array, at: Uint32, to: Uint32): [string, CborOffset] {
  const minor = peekMinor(payload, at);

  if (minor === minorIndefinite) {
    const [decoded, offset] = decodeUtf8StringIndefinite(payload, at, to);
    return [decodeView.toUtf8(decoded, 0, decoded.length), offset];
  }

  const [length, offset] = decodeArgument(payload, at, to);
  at += demote(offset);
  if (to - at < length) {
    throw new Error(`unstructured byte string len ${length} greater than remaining buf len.`);
  }

  const value = toUtf8(payload.subarray(at, at + demote(length)));
  return [value, offset + length];
}

function decodeUtf8StringIndefinite(
  payload: Uint8Array,
  at: Uint32,
  to: Uint32
): [CborUnstructuredByteStringType, CborOffset] {
  at += 1;
  const vector = new ByteVector(to - at);

  for (const base = at; at < to; ) {
    if (payload[at] === 0b1111_1111) {
      return [vector.toUint8Array(), BigInt(at - base + 2)];
    }

    const major = peekMajor(payload, at);
    const minor = peekMinor(payload, at);
    if (major !== majorUtf8String) {
      throw new Error(`unexpected major type ${major} in indefinite string.`);
    }
    if (minor === minorIndefinite) {
      throw new Error("nested indefinite string.");
    }

    const [str, _length] = decodeUtf8String(payload, at, to);
    const length = demote(_length);
    at += length;
    vector.writeString(str);
  }
  throw new Error("expected break marker.");
}

function decodeUnstructuredByteString(
  payload: Uint8Array,
  at: Uint32,
  to: Uint32
): [CborUnstructuredByteStringType, CborOffset] {
  const minor = peekMinor(payload, at);

  if (minor === minorIndefinite) {
    return decodeUnstructuredByteStringIndefinite(payload, at, to);
  }

  const [length, offset] = decodeArgument(payload, at, to);
  at += demote(offset);
  if (to - at < length) {
    throw new Error(`unstructured byte string len ${length} greater than remaining buf len.`);
  }

  const value = payload.subarray(at, at + demote(length));
  return [value, offset + length];
}

function decodeUnstructuredByteStringIndefinite(
  payload: Uint8Array,
  at: Uint32,
  to: Uint32
): [CborUnstructuredByteStringType, CborOffset] {
  at += 1;
  const vector = new ByteVector(to - at);

  for (const base = at; at < to; ) {
    if (payload[at] === 0b1111_1111) {
      return [vector.toUint8Array(), BigInt(at - base + 2)];
    }

    const major = peekMajor(payload, at);
    const minor = peekMinor(payload, at);
    if (major !== majorUnstructuredByteString) {
      throw new Error(`unexpected major type ${major} in indefinite string.`);
    }
    if (minor === minorIndefinite) {
      throw new Error("nested indefinite string.");
    }

    const [byteString, _length] = decodeUnstructuredByteString(payload, at, to);
    const length = demote(_length);
    at += length;
    vector.writeBytes(byteString);
  }
  throw new Error("expected break marker.");
}

function decodeList(
  payload: Uint8Array,
  at: Uint32,
  to: Uint32,
  bigIntBehavior: BigIntBehavior
): [CborListType, CborOffset] {
  const minor = peekMinor(payload, at);
  if (minor === minorIndefinite) {
    return decodeListIndefinite(payload, at, to, bigIntBehavior);
  }

  const [argumentLength, offset] = decodeArgument(payload, at, to);

  at += demote(offset);
  const base = at;

  const list = [];
  for (let i = 0; i < argumentLength; ++i) {
    const [item, itemOffset] = decode(payload, at, to, bigIntBehavior);

    list.push(item);

    at += demote(itemOffset);
  }

  return [list, offset + BigInt(at - base)];
}

function decodeListIndefinite(
  payload: Uint8Array,
  at: Uint32,
  to: Uint32,
  bigIntBehavior: BigIntBehavior
): [CborListType, CborOffset] {
  at += 1;

  const l = [] as CborListType;
  for (const base = at; at < to; ) {
    if (payload[at] === 255) {
      return [l, BigInt(at - base + 2)];
    }

    const [item, n] = decode(payload, at, to, bigIntBehavior);
    at += demote(n);

    l.push(item);
  }
  throw new Error("expected break marker.");
}

function decodeMap(
  payload: Uint8Array,
  at: Uint32,
  to: Uint32,
  bigIntBehavior: BigIntBehavior
): [CborMapType, CborOffset] {
  const minor = peekMinor(payload, at);
  if (minor === minorIndefinite) {
    return decodeMapIndefinite(payload, at, to, bigIntBehavior);
  }

  const [mapDataLength, offset] = decodeArgument(payload, at, to);
  at += demote(offset);

  const base = at;

  const mp = {} as CborMapType;
  for (let i = 0; i < mapDataLength; ++i) {
    if (at >= to) {
      throw new Error("unexpected end of map payload.");
    }

    const major = peekMajor(payload, at);
    if (major !== majorUtf8String) {
      throw new Error(`unexpected major type ${major} for map key at index ${at}.`);
    }

    const [key, kn] = decodeUtf8String(payload, at, to);
    at += demote(kn);

    const [value, vn] = decode(payload, at, to, bigIntBehavior);
    at += demote(vn);

    mp[key] = value;
  }

  return [mp, offset + BigInt(at - base)];
}

function decodeMapIndefinite(
  payload: Uint8Array,
  at: Uint32,
  to: Uint32,
  bigIntBehavior: BigIntBehavior
): [CborMapType, CborOffset] {
  at += 1;
  const base = at;

  const map = {} as CborMapType;
  for (; at < to; ) {
    if (at >= to) {
      throw new Error("unexpected end of map payload.");
    }

    if (payload[at] === 0b1111_1111) {
      return [map, BigInt(at - base + 2)];
    }

    const major = peekMajor(payload, at);
    if (major !== majorUtf8String) {
      throw new Error(`unexpected major type ${major} for map key.`);
    }

    const [key, kn] = decodeUtf8String(payload, at, to);
    at += demote(kn);

    const [value, vn] = decode(payload, at, to, bigIntBehavior);
    at += demote(vn);

    map[key] = value;
  }
  throw new Error("expected break marker.");
}

function decodeTag(
  payload: Uint8Array,
  at: Uint32,
  to: Uint32,
  bigIntBehavior: BigIntBehavior
): [CborTagType, CborOffset] {
  const [tag, offset] = decodeArgument(payload, at, to);
  at += demote(offset);

  const [value, valueOffset] = decode(payload, at, to, bigIntBehavior);

  return [{ tag: castBigInt(tag, bigIntBehavior), value }, offset + valueOffset];
}

function decodeSpecial(payload: Uint8Array, at: Uint32, to: Uint32): [CborValueType, CborOffset] {
  const minor = peekMinor(payload, at);
  switch (minor) {
    case specialTrue:
    case specialFalse:
      return [minor === specialTrue, BigInt(1)];
    case specialNull:
      return [null, BigInt(1)];
    case specialUndefined:
      // Note: the Smithy spec requires that undefined is
      // instead deserialized to null.
      return [null, BigInt(1)];
    case specialFloat16:
      if (to - at < 3) {
        throw new Error("incomplete float16 at end of buf.");
      }
      const u16 = decodeView.dataView.getUint16(at + 1);
      return [uint32ToFloat32(float16ToUint32(u16)), BigInt(3)];
    case specialFloat32:
      if (to - at < 5) {
        throw new Error("incomplete float32 at end of buf.");
      }
      return [decodeView.dataView.getFloat32(at + 1), BigInt(5)];
    case specialFloat64:
      if (to - at < 9) {
        throw new Error("incomplete float64 at end of buf.");
      }
      return [decodeView.dataView.getFloat64(at + 1), BigInt(9)];
    default:
      throw new Error(`unexpected minor value ${minor}.`);
  }
}

function castBigInt(bigInt: bigint, bigIntBehavior: "castSafe"): number | bigint;
function castBigInt(bigInt: bigint, bigIntBehavior: "castNone"): bigint;
function castBigInt(bigInt: bigint, bigIntBehavior: "castAllUnsafe"): number;
function castBigInt(bigInt: bigint, bigIntBehavior: BigIntBehavior): number | bigint;
function castBigInt(bigInt: bigint, bigIntBehavior: BigIntBehavior): number | bigint {
  switch (bigIntBehavior) {
    case "castNone":
      return bigInt;
    case "castAllUnsafe":
      return Number(bigInt);
    case "castSafe":
      const num = Number(bigInt);
      if (Number.MIN_SAFE_INTEGER <= num && num <= Number.MAX_SAFE_INTEGER) {
        return Number(bigInt);
      }
      return bigInt;
  }
}

function decode(payload: Uint8Array, at: Uint32, to: Uint32, bigIntBehavior: BigIntBehavior): [CborValueType, Uint64] {
  if (at >= to) {
    throw new Error("unexpected end of (decode) payload.");
  }

  switch (peekMajor(payload, at)) {
    case majorUint64:
      const [unsignedInt, offset1] = decodeUnsignedInt(payload, at, to);
      return [castBigInt(unsignedInt, bigIntBehavior), offset1];
    case majorNegativeInt64:
      const [negativeInt, offset2] = decodeNegativeInt(payload, at, to);
      return [castBigInt(negativeInt, bigIntBehavior), offset2];
    case majorUnstructuredByteString:
      return decodeUnstructuredByteString(payload, at, to);
    case majorUtf8String:
      return decodeUtf8String(payload, at, to);
    case majorList:
      return decodeList(payload, at, to, bigIntBehavior);
    case majorMap:
      return decodeMap(payload, at, to, bigIntBehavior);
    case majorTag:
      return decodeTag(payload, at, to, bigIntBehavior);
    default:
      return decodeSpecial(payload, at, to);
  }
}

// encode

function encodeHeader(major: CborMajorType, value: Uint64 | number): void {
  if (value < 24) {
    byteVector.write((major << 5) | (value as number));
    return;
  } else if (value < TWO.EIGHT) {
    byteVector.write((major << 5) | 24);
    byteVector.write(value as number);
    return;
  } else if (value < TWO.SIXTEEN) {
    byteVector.writeUnsignedInt((major << 5) | specialFloat16, 16, value);
    return;
  } else if (value < TWO.THIRTY_TWO) {
    byteVector.writeUnsignedInt((major << 5) | specialFloat32, 32, value);
    return;
  }
  byteVector.writeUnsignedInt((major << 5) | specialFloat64, 64, value);
  return;
}

function compose(major: CborMajorType, minor: Uint8): Uint8 {
  return (major << 5) | minor;
}

/**
 * @param input - JS data object.
 */
function encode(input: any): void {
  if (input === null) {
    byteVector.write(compose(majorSpecial, specialNull));
    return;
  }

  switch (typeof input) {
    case "undefined":
      // Note: Smithy spec requires that undefined not be serialized
      // though the CBOR spec includes it.
      // buffer[0] = compose(majorSpecial, specialUndefined);
      // return 1;
      throw new Error("@smithy/core/cbor: client may not serialize undefined value.");
    case "boolean":
      byteVector.write(compose(majorSpecial, input ? specialTrue : specialFalse));
      return;
    case "number":
      if (Number.isInteger(input)) {
        input >= 0 ? encodeHeader(majorUint64, input) : encodeHeader(majorNegativeInt64, Math.abs(input) - 1);
        return;
      }
      byteVector.writeFloat64(compose(majorSpecial, specialFloat64), input);
      return;
    case "bigint":
      input >= 0 ? encodeHeader(majorUint64, input) : encodeHeader(majorNegativeInt64, -input - BigInt(1));
      return;
    case "string":
      encodeHeader(majorUtf8String, input.length);
      byteVector.writeString(input);
      return;
  }

  if (Array.isArray(input)) {
    const _input = input.filter(notUndef);
    encodeHeader(majorList, _input.length);
    for (const vv of _input) {
      encode(vv);
    }
    return;
  } else if (typeof input.byteLength === "number") {
    encodeHeader(majorUnstructuredByteString, input.length);
    byteVector.writeBytes(input);
    return;
  } else if (typeof input === "object") {
    const entries = Object.entries(input).filter(valueNotUndef);
    encodeHeader(majorMap, entries.length);
    for (const [key, value] of entries) {
      encode(key);
      encode(value);
    }
    return;
  }

  throw new Error(`data type ${input?.constructor?.name ?? typeof input} not compatible for encoding.`);
}

const notUndef = <T>(_: T) => _ !== undefined;
const valueNotUndef = <T>([, v]: [unknown, T]) => v !== undefined;

/**
 * @public
 * castNone - All positive and negative integers remain BigInt.
 * castSafe - All BigInts that won't lose precision get cast to number.
 * castUnsafe - All BigInts get cast to number.
 */
export type BigIntBehavior = "castNone" | "castSafe" | "castAllUnsafe";

export const cbor = {
  deserialize(payload: Uint8Array, bigIntBehavior: BigIntBehavior = "castSafe") {
    decodeView.set(payload);
    return decode(payload, 0, payload.length, bigIntBehavior)[0];
  },
  serialize(input: any) {
    encode(input);
    return byteVector.toUint8Array();
  },
};
