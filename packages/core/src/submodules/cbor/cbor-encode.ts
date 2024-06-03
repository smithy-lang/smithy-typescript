import { byteVector } from "./ByteVector";
import {
  CborMajorType,
  majorList,
  majorMap,
  majorNegativeInt64,
  majorSpecial,
  majorUint64,
  majorUnstructuredByteString,
  majorUtf8String,
  specialFalse,
  specialFloat16,
  specialFloat32,
  specialFloat64,
  specialNull,
  specialTrue,
  Uint8,
  Uint64,
} from "./cbor";

/**
 * Powers of 2.
 */
export const TWO = {
  EIGHT: 1 << 8,
  SIXTEEN: 1 << 16,
  THIRTY_TWO: 2 ** 32,
};

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
export function encode(input: any): void {
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
