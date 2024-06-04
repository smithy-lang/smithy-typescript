import { ByteVector } from "./ByteVector";
import {
  CborArgumentLength,
  CborArgumentLengthOffset,
  CborListType,
  CborMapType,
  CborOffset,
  CborTagType,
  CborUnstructuredByteStringType,
  CborValueType,
  extendedFloat16,
  extendedFloat32,
  extendedFloat64,
  extendedOneByte,
  Float16Binary,
  Float32Binary,
  Int64,
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
  Uint8,
  Uint32,
  Uint64,
} from "./cbor-types";
import { decodeView } from "./DecodeView";

/**
 * @internal
 */
export function demote(bigInteger: bigint): number {
  const num = Number(bigInteger);
  if (num < Number.MIN_SAFE_INTEGER || Number.MAX_SAFE_INTEGER < num) {
    console.warn(new Error(`@smithy/core/cbor - truncating BigInt(${bigInteger}) to ${num} with loss of precision.`));
  }
  return num;
}

const minorValueToArgumentLength = {
  [extendedOneByte]: 1,
  [extendedFloat16]: 2,
  [extendedFloat32]: 4,
  [extendedFloat64]: 8,
} as const;

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

function decodeCount(payload: Uint8Array, at: Uint32, to: Uint32): [number, CborArgumentLengthOffset] {
  const minor = peekMinor(payload, at);

  if (minor < 24) {
    return [minor, 1 as CborArgumentLengthOffset];
  }

  if (
    minor === extendedOneByte ||
    minor === extendedFloat16 ||
    minor === extendedFloat32 ||
    minor === extendedFloat64
  ) {
    const countLength: CborArgumentLength = minorValueToArgumentLength[minor];
    const countOffset = (countLength + 1) as CborArgumentLengthOffset;
    if (to - at < countOffset) {
      throw new Error(`countLength ${countLength} greater than remaining buf len.`);
    }
    const countIndex = at + 1;
    if (countLength === 1) {
      return [payload[countIndex], countOffset as CborArgumentLengthOffset];
    } else if (countLength === 2) {
      return [decodeView.dataView.getUint16(countIndex), countOffset as CborArgumentLengthOffset];
    } else if (countLength === 4) {
      return [decodeView.dataView.getUint32(countIndex), countOffset as CborArgumentLengthOffset];
    }
    return [demote(decodeView.dataView.getBigUint64(countIndex)), countOffset as CborArgumentLengthOffset];
  }

  throw new Error(`unexpected minor value ${minor}.`);
}

function decodeCountBigInt(payload: Uint8Array, at: Uint32, to: Uint32): [Uint64 | number, CborArgumentLengthOffset] {
  const minor = peekMinor(payload, at);
  if (minor < 24) {
    return [minor, 1 as CborArgumentLengthOffset];
  }

  if (
    minor === extendedOneByte ||
    minor === extendedFloat16 ||
    minor === extendedFloat32 ||
    minor === extendedFloat64
  ) {
    const countLength: CborArgumentLength = minorValueToArgumentLength[minor];
    const countOffset = (countLength + 1) as CborArgumentLengthOffset;
    if (to - at < countOffset) {
      throw new Error(`countLength ${countLength} greater than remaining buf len.`);
    }
    const countIndex = at + 1;
    if (countLength === 1) {
      return [payload[countIndex], countOffset as CborArgumentLengthOffset];
    } else if (countLength === 2) {
      return [decodeView.dataView.getUint16(countIndex), countOffset as CborArgumentLengthOffset];
    } else if (countLength === 4) {
      return [decodeView.dataView.getUint32(countIndex), countOffset as CborArgumentLengthOffset];
    }
    return [decodeView.dataView.getBigUint64(countIndex), countOffset as CborArgumentLengthOffset];
  }

  throw new Error(`unexpected minor value ${minor}.`);
}

const decodeUnsignedInt = decodeCountBigInt;

function decodeNegativeInt(payload: Uint8Array, at: Uint32, to: Uint32): [Int64 | number, CborArgumentLengthOffset] {
  const [value, offset] = decodeCountBigInt(payload, at, to);
  if (typeof value === "bigint") {
    return [BigInt(-1) - value, offset];
  }
  return [-1 - value, offset];
}

function decodeUtf8String(payload: Uint8Array, at: Uint32, to: Uint32): [string, CborOffset] {
  const minor = peekMinor(payload, at);

  if (minor === minorIndefinite) {
    const [decoded, offset] = decodeUtf8StringIndefinite(payload, at, to);
    return [decodeView.toUtf8(decoded, 0, decoded.length), offset];
  }

  const [length, offset] = decodeCount(payload, at, to);
  at += offset;
  if (to - at < length) {
    throw new Error(`unstructured byte string len ${length} greater than remaining buf len.`);
  }

  const value = decodeView.toUtf8(payload, at, at + length);
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
      return [vector.toUint8Array(), at - base + 2];
    }

    const major = peekMajor(payload, at);
    const minor = peekMinor(payload, at);
    if (major !== majorUtf8String) {
      throw new Error(`unexpected major type ${major} in indefinite string.`);
    }
    if (minor === minorIndefinite) {
      throw new Error("nested indefinite string.");
    }

    const [str, length] = decodeUtf8String(payload, at, to);
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

  const [length, offset] = decodeCount(payload, at, to);
  at += offset;
  if (to - at < length) {
    throw new Error(`unstructured byte string len ${length} greater than remaining buf len.`);
  }

  const value = payload.subarray(at, at + length);
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
      return [vector.toUint8Array(), at - base + 2];
    }

    const major = peekMajor(payload, at);
    const minor = peekMinor(payload, at);
    if (major !== majorUnstructuredByteString) {
      throw new Error(`unexpected major type ${major} in indefinite string.`);
    }
    if (minor === minorIndefinite) {
      throw new Error("nested indefinite string.");
    }

    const [byteString, length] = decodeUnstructuredByteString(payload, at, to);
    at += length;
    vector.writeBytes(byteString);
  }
  throw new Error("expected break marker.");
}

function decodeList(payload: Uint8Array, at: Uint32, to: Uint32): [CborListType, CborOffset] {
  const minor = peekMinor(payload, at);
  if (minor === minorIndefinite) {
    return decodeListIndefinite(payload, at, to);
  }

  const [listDataLength, offset] = decodeCount(payload, at, to);

  at += offset;
  const base = at;

  const list = [];
  for (let i = 0; i < listDataLength; ++i) {
    const [item, itemOffset] = decode(payload, at, to);

    list.push(item);

    at += itemOffset;
  }

  return [list, offset + (at - base)];
}

function decodeListIndefinite(payload: Uint8Array, at: Uint32, to: Uint32): [CborListType, CborOffset] {
  at += 1;

  const l = [] as CborListType;
  for (const base = at; at < to; ) {
    if (payload[at] === 255) {
      return [l, at - base + 2];
    }

    const [item, n] = decode(payload, at, to);
    at += n;

    l.push(item);
  }
  throw new Error("expected break marker.");
}

function decodeMap(payload: Uint8Array, at: Uint32, to: Uint32): [CborMapType, CborOffset] {
  const minor = peekMinor(payload, at);
  if (minor === minorIndefinite) {
    return decodeMapIndefinite(payload, at, to);
  }

  const [mapDataLength, offset] = decodeCount(payload, at, to);
  at += offset;

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
    at += kn;

    const [value, vn] = decode(payload, at, to);
    at += vn;

    mp[key] = value;

    if (isNaN(at)) {
      console.log("wth", at, offset, kn, value, vn);
      throw new Error();
    }
  }

  return [mp, offset + (at - base)];
}

function decodeMapIndefinite(payload: Uint8Array, at: Uint32, to: Uint32): [CborMapType, CborOffset] {
  at += 1;
  const base = at;

  const map = {} as CborMapType;
  for (; at < to; ) {
    if (at >= to) {
      throw new Error("unexpected end of map payload.");
    }

    if (payload[at] === 0b1111_1111) {
      return [map, at - base + 2];
    }

    const major = peekMajor(payload, at);
    if (major !== majorUtf8String) {
      throw new Error(`unexpected major type ${major} for map key.`);
    }

    const [key, kn] = decodeUtf8String(payload, at, to);
    at += kn;

    const [value, vn] = decode(payload, at, to);
    at += vn;

    map[key] = value;
  }
  throw new Error("expected break marker.");
}

function decodeTag(payload: Uint8Array, at: Uint32, to: Uint32): [CborTagType, CborOffset] {
  const [tag, offset] = decodeCountBigInt(payload, at, to);
  at += offset;

  const [value, valueOffset] = decode(payload, at, to);

  return [{ tag: castBigInt(tag), value: value } as any, offset + valueOffset];
}

function decodeSpecial(payload: Uint8Array, at: Uint32, to: Uint32): [CborValueType, CborOffset] {
  const minor = peekMinor(payload, at);
  switch (minor) {
    case specialTrue:
    case specialFalse:
      return [minor === specialTrue, 1];
    case specialNull:
      return [null, 1];
    case specialUndefined:
      // Note: the Smithy spec requires that undefined is
      // instead deserialized to null.
      return [null, 1];
    case extendedFloat16:
      if (to - at < 3) {
        throw new Error("incomplete float16 at end of buf.");
      }
      const u16 = decodeView.dataView.getUint16(at + 1);
      return [uint32ToFloat32(float16ToUint32(u16)), 3];
    case extendedFloat32:
      if (to - at < 5) {
        throw new Error("incomplete float32 at end of buf.");
      }
      return [decodeView.dataView.getFloat32(at + 1), 5];
    case extendedFloat64:
      if (to - at < 9) {
        throw new Error("incomplete float64 at end of buf.");
      }
      return [decodeView.dataView.getFloat64(at + 1), 9];
    default:
      throw new Error(`unexpected minor value ${minor}.`);
  }
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

export function decode(payload: Uint8Array, at: Uint32, to: Uint32): [CborValueType, CborOffset] {
  if (at >= to) {
    throw new Error("unexpected end of (decode) payload.");
  }

  switch (peekMajor(payload, at)) {
    case majorUint64:
      const [unsignedInt, offset1] = decodeUnsignedInt(payload, at, to);
      return [castBigInt(unsignedInt), offset1];
    case majorNegativeInt64:
      const [negativeInt, offset2] = decodeNegativeInt(payload, at, to);
      return [castBigInt(negativeInt), offset2];
    case majorUnstructuredByteString:
      return decodeUnstructuredByteString(payload, at, to);
    case majorUtf8String:
      return decodeUtf8String(payload, at, to);
    case majorList:
      return decodeList(payload, at, to);
    case majorMap:
      return decodeMap(payload, at, to);
    case majorTag:
      return decodeTag(payload, at, to);
    default:
      return decodeSpecial(payload, at, to);
  }
}
