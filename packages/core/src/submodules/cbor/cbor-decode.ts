import { toUtf8 } from "@smithy/util-utf8";

import {
  alloc,
  CborArgumentLength,
  CborArgumentLengthOffset,
  CborListType,
  CborMapType,
  CborOffset,
  CborUnstructuredByteStringType,
  CborValueType,
  extendedFloat16,
  extendedFloat32,
  extendedFloat64,
  extendedOneByte,
  Float16Binary,
  Float32Binary,
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
  Uint32,
  Uint64,
} from "./cbor-types";

const USE_TEXT_DECODER = typeof TextDecoder !== "undefined";

let payload = alloc(0);
let dataView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
const textDecoder = USE_TEXT_DECODER ? new TextDecoder() : null;

/**
 * @internal
 * @param bytes - to be set as the decode source.
 *
 * Sets the decode bytearray source and its data view.
 */
export function setPayload(bytes: Uint8Array) {
  payload = bytes;
  dataView = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
}

/**
 * @internal
 * Decodes the data between the two indices.
 */
export function decode(at: Uint32, to: Uint32): [CborValueType, CborOffset] {
  if (at >= to) {
    throw new Error("unexpected end of (decode) payload.");
  }

  const major = (payload[at] & 0b1110_0000) >> 5;
  const minor = payload[at] & 0b0001_1111;

  switch (major) {
    case majorUint64:
    case majorNegativeInt64:
    case majorTag:
      let unsignedInt: number | Uint64;
      let offset: number;

      if (minor < 24) {
        unsignedInt = minor;
        offset = 1;
      } else {
        switch (minor) {
          case extendedOneByte:
          case extendedFloat16:
          case extendedFloat32:
          case extendedFloat64:
            const countLength: CborArgumentLength = minorValueToArgumentLength[minor];
            const countOffset = (countLength + 1) as CborArgumentLengthOffset;
            if (to - at < countOffset) {
              throw new Error(`countLength ${countLength} greater than remaining buf len.`);
            }
            const countIndex = at + 1;
            if (countLength === 1) {
              [unsignedInt, offset] = [payload[countIndex], countOffset as CborArgumentLengthOffset];
            } else if (countLength === 2) {
              [unsignedInt, offset] = [dataView.getUint16(countIndex), countOffset as CborArgumentLengthOffset];
            } else if (countLength === 4) {
              [unsignedInt, offset] = [dataView.getUint32(countIndex), countOffset as CborArgumentLengthOffset];
            } else {
              [unsignedInt, offset] = [dataView.getBigUint64(countIndex), countOffset as CborArgumentLengthOffset];
            }
            break;
          default:
            throw new Error(`unexpected minor value ${minor}.`);
        }
      }

      if (major === majorUint64) {
        return [castBigInt(unsignedInt), offset];
      } else if (major === majorNegativeInt64) {
        let negativeInt: bigint | number;
        if (typeof unsignedInt === "bigint") {
          negativeInt = BigInt(-1) - unsignedInt;
        } else {
          negativeInt = -1 - unsignedInt;
        }
        return [castBigInt(negativeInt), offset];
      } else {
        const [value, valueOffset] = decode(at + offset, to);

        return [{ tag: castBigInt(unsignedInt), value }, offset + valueOffset];
      }
    case majorUnstructuredByteString:
      return decodeUnstructuredByteString(at, to);
    case majorUtf8String: {
      if (minor === minorIndefinite) {
        at += 1;
        const vector = [];
        for (const base = at; at < to; ) {
          if (payload[at] === 0b1111_1111) {
            const data = alloc(vector.length);
            data.set(vector, 0);
            return [bytesToUtf8(data, 0, data.length), at - base + 2];
          }
          const major = (payload[at] & 0b1110_0000) >> 5;
          const minor = payload[at] & 0b0001_1111;
          if (major !== majorUtf8String) {
            throw new Error(`unexpected major type ${major} in indefinite string.`);
          }
          if (minor === minorIndefinite) {
            throw new Error("nested indefinite string.");
          }
          const [bytes, length] = decodeUnstructuredByteString(at, to);
          at += length;
          vector.push(...bytes);
        }
        throw new Error("expected break marker.");
      }
      const [length, offset] = decodeCount(at, to);
      at += offset;
      if (to - at < length) {
        throw new Error(`string len ${length} greater than remaining buf len.`);
      }
      const value = bytesToUtf8(payload, at, at + length);
      return [value, offset + length];
    }
    case majorList: {
      if (minor === minorIndefinite) {
        at += 1;
        const list = [] as CborListType;
        for (const base = at; at < to; ) {
          if (payload[at] === 0b1111_1111) {
            return [list, at - base + 2];
          }
          const [item, n] = decode(at, to);
          at += n;
          list.push(item);
        }
        throw new Error("expected break marker.");
      }
      const [listDataLength, offset] = decodeCount(at, to);
      at += offset;
      const base = at;
      // perf: pre-allocate array length.
      const list = Array(listDataLength);
      for (let i = 0; i < listDataLength; ++i) {
        const [item, itemOffset] = decode(at, to);
        list[i] = item;
        at += itemOffset;
      }
      return [list, offset + (at - base)];
    }
    case majorMap: {
      if (minor === minorIndefinite) {
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
          const major = (payload[at] & 0b1110_0000) >> 5;
          if (major !== majorUtf8String) {
            throw new Error(`unexpected major type ${major} for map key.`);
          }
          const [key, kn] = decode(at, to);
          at += kn;
          const [value, vn] = decode(at, to);
          at += vn;
          map[key] = value;
        }
        throw new Error("expected break marker.");
      }
      const [mapDataLength, offset] = decodeCount(at, to);
      at += offset;
      const base = at;
      const map = {} as CborMapType;
      for (let i = 0; i < mapDataLength; ++i) {
        if (at >= to) {
          throw new Error("unexpected end of map payload.");
        }
        const major = (payload[at] & 0b1110_0000) >> 5;
        if (major !== majorUtf8String) {
          throw new Error(`unexpected major type ${major} for map key at index ${at}.`);
        }
        const [key, kn] = decode(at, to);
        at += kn;
        const [value, vn] = decode(at, to);
        at += vn;
        map[key] = value;
      }
      return [map, offset + (at - base)];
    }
    default:
      return decodeSpecial(at, to);
  }
}

function bytesToUtf8(bytes: Uint8Array, at: number, to: number): string {
  if (textDecoder) {
    return textDecoder.decode(bytes.subarray(at, to));
  }
  return toUtf8(bytes.subarray(at, to));
}

function demote(bigInteger: bigint): number {
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

function decodeCount(at: Uint32, to: Uint32): [number, CborArgumentLengthOffset] {
  const minor = payload[at] & 0b0001_1111;

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
      return [dataView.getUint16(countIndex), countOffset as CborArgumentLengthOffset];
    } else if (countLength === 4) {
      return [dataView.getUint32(countIndex), countOffset as CborArgumentLengthOffset];
    }
    return [demote(dataView.getBigUint64(countIndex)), countOffset as CborArgumentLengthOffset];
  }

  throw new Error(`unexpected minor value ${minor}.`);
}

function decodeUnstructuredByteString(at: Uint32, to: Uint32): [CborUnstructuredByteStringType, CborOffset] {
  const minor = payload[at] & 0b0001_1111;

  if (minor === minorIndefinite) {
    return decodeUnstructuredByteStringIndefinite(at, to);
  }

  const [length, offset] = decodeCount(at, to);
  at += offset;
  if (to - at < length) {
    throw new Error(`unstructured byte string len ${length} greater than remaining buf len.`);
  }

  const value = payload.subarray(at, at + length);
  return [value, offset + length];
}

function decodeUnstructuredByteStringIndefinite(at: Uint32, to: Uint32): [CborUnstructuredByteStringType, CborOffset] {
  at += 1;
  const vector = [];

  for (const base = at; at < to; ) {
    if (payload[at] === 0b1111_1111) {
      const data = alloc(vector.length);
      data.set(vector, 0);
      return [data, at - base + 2];
    }

    const major = (payload[at] & 0b1110_0000) >> 5;
    const minor = payload[at] & 0b0001_1111;
    if (major !== majorUnstructuredByteString) {
      throw new Error(`unexpected major type ${major} in indefinite string.`);
    }
    if (minor === minorIndefinite) {
      throw new Error("nested indefinite string.");
    }

    const [bytes, length] = decodeUnstructuredByteString(at, to);
    at += length;
    vector.push(...bytes);
  }
  throw new Error("expected break marker.");
}

function decodeSpecial(at: Uint32, to: Uint32): [CborValueType, CborOffset] {
  const minor = payload[at] & 0b0001_1111;
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
      const u16 = dataView.getUint16(at + 1);
      return [uint32ToFloat32(float16ToUint32(u16)), 3];
    case extendedFloat32:
      if (to - at < 5) {
        throw new Error("incomplete float32 at end of buf.");
      }
      return [dataView.getFloat32(at + 1), 5];
    case extendedFloat64:
      if (to - at < 9) {
        throw new Error("incomplete float64 at end of buf.");
      }
      return [dataView.getFloat64(at + 1), 9];
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
