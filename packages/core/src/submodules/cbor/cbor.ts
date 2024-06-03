import { fromUtf8, toUtf8 } from "@smithy/util-utf8";

import { byteVector, join } from "./ByteVector";

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

const offsetDataView = (payload: Uint8Array): DataView =>
  new DataView(payload.buffer, payload.buffer.byteLength - payload.length);

function peekMajor(payload: Uint8Array): Uint8 {
  return (payload[0] & 0b1110_0000) >> 5;
}

function peekMinor(payload: Uint8Array): Uint8 {
  return payload[0] & 0b0001_1111;
}

function decodeArgument(payload: Uint8Array): [Uint64, CborArgumentLengthOffset] {
  const minor = peekMinor(payload);
  if (minor < 24) {
    return [BigInt(minor), BigInt(1) as CborArgumentLengthOffset];
  }

  switch (minor) {
    case specialOneByte:
    case specialFloat16:
    case specialFloat32:
    case specialFloat64:
      const argLen: CborArgumentLength = minorValueToArgumentLength(minor);
      if (payload.length < argLen + 1) {
        throw new Error(`arg len ${argLen} greater than remaining buf len.`);
      }

      return [readArgument(payload.subarray(1), argLen), (BigInt(argLen) + BigInt(1)) as CborArgumentLengthOffset];
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

function readArgument(payload: Uint8Array, byteLength: number): Uint64 {
  if (byteLength === 1) return BigInt(payload[0]);
  if (byteLength === 2) return BigInt(offsetDataView(payload).getUint16(0));
  if (byteLength === 4) return BigInt(offsetDataView(payload).getUint32(0));

  return offsetDataView(payload).getBigUint64(0);
}

function decodeUnsignedInt(payload: Uint8Array): [Uint64, CborArgumentLengthOffset] {
  return decodeArgument(payload);
}

function decodeNegativeInt(payload: Uint8Array): [Int64, CborArgumentLengthOffset] {
  const [i, offset] = decodeArgument(payload);
  return [-BigInt(1) - i, offset];
}

function decodeUnstructuredByteString(payload: Uint8Array): [CborUnstructuredByteStringType, CborOffset] {
  return decodeString(payload, majorUnstructuredByteString);
}

function decodeUtf8String(payload: Uint8Array): [string, CborOffset] {
  return decodeString(payload, majorUtf8String);
}

function decodeString<M extends typeof majorUtf8String | typeof majorUnstructuredByteString>(
  payload: Uint8Array,
  inner: M
): [M extends typeof majorUtf8String ? string : CborUnstructuredByteStringType, CborOffset] {
  const minor = peekMinor(payload);

  if (minor === minorIndefinite) {
    const [decoded, offset] = decodeStringIndefinite(payload, inner);
    return (inner === majorUnstructuredByteString ? [decoded, offset] : [toUtf8(decoded), offset]) as [
      M extends typeof majorUtf8String ? string : CborUnstructuredByteStringType,
      CborOffset,
    ];
  }

  const [length, offset] = decodeArgument(payload);
  payload = payload.subarray(demote(offset));
  if (payload.length < length) {
    throw new Error(`unstructured byte string len ${length} greater than remaining buf len.`);
  }

  const value =
    inner === majorUnstructuredByteString
      ? payload.subarray(0, demote(length))
      : toUtf8(payload.subarray(0, demote(length)));
  return [value as M extends typeof majorUtf8String ? string : CborUnstructuredByteStringType, offset + length];
}

function decodeStringIndefinite<I extends typeof majorUtf8String | typeof majorUnstructuredByteString>(
  payload: Uint8Array,
  inner: I
): [CborUnstructuredByteStringType, CborOffset] {
  payload = payload.subarray(1);

  const buffer = [];

  for (let offset = 0; payload.length > 0; ) {
    if (payload[0] === 0b1111_1111) {
      return [join(buffer), BigInt(offset + 2)];
    }

    const major = peekMajor(payload);
    const minor = peekMinor(payload);
    if (major !== inner) {
      throw new Error(`unexpected major type ${major} in indefinite string.`);
    }
    if (minor === minorIndefinite) {
      throw new Error("nested indefinite string.");
    }

    if (inner === majorUtf8String) {
      const [str, _length] = decodeUtf8String(payload);
      const length = demote(_length);
      payload = payload.subarray(length);
      buffer.push(fromUtf8(str));
      offset += length;
    } else {
      const [byteString, _length] = decodeUnstructuredByteString(payload);
      const length = demote(_length);
      payload = payload.subarray(length);
      buffer.push(byteString);
      offset += length;
    }
  }
  throw new Error("expected break marker.");
}

function decodeList(payload: Uint8Array, bigIntBehavior: BigIntBehavior): [CborListType, CborOffset] {
  const minor = peekMinor(payload);
  if (minor === minorIndefinite) {
    return decodeListIndefinite(payload, bigIntBehavior);
  }

  const [argumentLength, _offset] = decodeArgument(payload);
  let offset = _offset;

  payload = payload.subarray(demote(offset));

  const list = [];
  for (let i = 0; i < argumentLength; ++i) {
    const [item, n] = decode(payload, bigIntBehavior);
    payload = payload.subarray(demote(n));

    list.push(item);
    offset += n;
  }

  return [list, offset];
}

function decodeListIndefinite(payload: Uint8Array, bigIntBehavior: BigIntBehavior): [CborListType, CborOffset] {
  payload = payload.subarray(1);

  const l = [] as CborListType;
  for (let offset = 0; payload.length > 0; ) {
    if (payload[0] === 255) {
      return [l, BigInt(offset + 2)];
    }

    const [item, n] = decode(payload, bigIntBehavior);
    payload = payload.subarray(demote(n));

    l.push(item);
    offset += demote(n);
  }
  throw new Error("expected break marker.");
}

function decodeMap(payload: Uint8Array, bigIntBehavior: BigIntBehavior): [CborMapType, CborOffset] {
  const minor = peekMinor(payload);
  if (minor === minorIndefinite) {
    return decodeMapIndefinite(payload, bigIntBehavior);
  }

  const [mapDataLength, _offset] = decodeArgument(payload);
  let offset = _offset;
  payload = payload.subarray(demote(offset));

  const mp = {} as CborMapType;
  for (let i = 0; i < mapDataLength; ++i) {
    if (payload.length === 0) {
      throw new Error("unexpected end of map payload.");
    }

    const major = peekMajor(payload);
    if (major !== majorUtf8String) {
      throw new Error(
        `unexpected major type ${major} for map key at index ${payload.buffer.byteLength - payload.length}.`
      );
    }

    const [key, kn] = decodeUtf8String(payload);
    payload = payload.subarray(demote(kn));

    const [value, vn] = decode(payload, bigIntBehavior);
    payload = payload.subarray(demote(vn));

    mp[key] = value;
    offset += kn + vn;
  }

  return [mp, offset];
}

function decodeMapIndefinite(payload: Uint8Array, bigIntBehavior: BigIntBehavior): [CborMapType, CborOffset] {
  payload = payload.subarray(1);

  const map = {} as CborMapType;
  for (let offset = BigInt(0); payload.length > 0; ) {
    if (payload.length === 0) {
      throw new Error("unexpected end of map payload.");
    }

    if (payload[0] === 0b1111_1111) {
      return [map, offset + BigInt(2)];
    }

    const major = peekMajor(payload);
    if (major !== majorUtf8String) {
      throw new Error(`unexpected major type ${major} for map key.`);
    }

    const [key, kn] = decodeUtf8String(payload);
    payload = payload.subarray(demote(kn));

    const [value, vn] = decode(payload, bigIntBehavior);
    payload = payload.subarray(demote(vn));

    map[key] = value;
    offset += kn + vn;
  }
  throw new Error("expected break marker.");
}

function decodeTag(payload: Uint8Array, bigIntBehavior: BigIntBehavior): [CborTagType, CborOffset] {
  const [tag, off] = decodeArgument(payload);
  payload = payload.subarray(demote(off));

  const [value, n] = decode(payload, bigIntBehavior);

  return [{ tag: castBigInt(tag, bigIntBehavior), value }, off + n];
}

function decodeSpecial(payload: Uint8Array): [CborValueType, CborOffset] {
  const minor = peekMinor(payload);
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
      if (payload.length < 3) {
        throw new Error("incomplete float16 at end of buf.");
      }
      const u16 = offsetDataView(payload.subarray(1)).getUint16(0);
      return [uint32ToFloat32(float16ToUint32(u16)), BigInt(3)];
    case specialFloat32:
      if (payload.length < 5) {
        throw new Error("incomplete float32 at end of buf.");
      }
      return [offsetDataView(payload.subarray(1)).getFloat32(0), BigInt(5)];
    case specialFloat64:
      if (payload.length < 9) {
        throw new Error("incomplete float64 at end of buf.");
      }
      return [offsetDataView(payload.subarray(1)).getFloat64(0), BigInt(9)];
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

function decode(payload: Uint8Array, bigIntBehavior: BigIntBehavior): [CborValueType, Uint64] {
  if (payload.length === 0) {
    throw new Error("unexpected end of (decode) payload.");
  }

  switch (peekMajor(payload)) {
    case majorUint64:
      const [unsignedInt, offset1] = decodeUnsignedInt(payload);
      return [castBigInt(unsignedInt, bigIntBehavior), offset1];
    case majorNegativeInt64:
      const [negativeInt, offset2] = decodeNegativeInt(payload);
      return [castBigInt(negativeInt, bigIntBehavior), offset2];
    case majorUnstructuredByteString:
      return decodeUnstructuredByteString(payload);
    case majorUtf8String:
      return decodeUtf8String(payload);
    case majorList:
      return decodeList(payload, bigIntBehavior);
    case majorMap:
      return decodeMap(payload, bigIntBehavior);
    case majorTag:
      return decodeTag(payload, bigIntBehavior);
    default:
      return decodeSpecial(payload);
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
    byteVector.writeUnsignedInt(major, 16, value);
    return;
  } else if (value < TWO.THIRTY_TWO) {
    byteVector.writeUnsignedInt(major, 32, value);
    return;
  }
  byteVector.writeUnsignedInt(major, 64, value);
  return;
}

function compose(major: CborMajorType, minor: Uint8): Uint8 {
  return (major << 5) | minor;
}

/**
 * @param input - JS data object.
 * @param byteVector - mutated, not returned.
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
      const float64Container = new Uint8Array(9);
      float64Container[0] = compose(majorSpecial, specialFloat64);
      offsetDataView(float64Container).setFloat64(1, input);
      byteVector.writeSeries(float64Container);
      return;
    case "bigint":
      input >= 0 ? encodeHeader(majorUint64, input) : encodeHeader(majorNegativeInt64, -input - BigInt(1));
      return;
    case "string":
      encodeHeader(majorUtf8String, input.length);
      byteVector.writeSeries(fromUtf8(input));
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
    byteVector.writeSeries(input);
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
    return decode(payload, bigIntBehavior)[0];
  },
  serialize(input: any) {
    encode(input);
    return byteVector.toUint8Array();
  },
};
