import { byteVector } from "./ByteVector";
import {
  CborMajorType,
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
  Uint64,
} from "./cbor-types";

function encodeHeader(major: CborMajorType, value: Uint64 | number): void {
  if (value < 24) {
    byteVector.write((major << 5) | (value as number));
  } else if (value < 1 << 8) {
    byteVector.write((major << 5) | 24);
    byteVector.write(value as number);
  } else if (value < 1 << 16) {
    byteVector.writeUint16((major << 5) | extendedFloat16, value as number);
  } else if (value < 2 ** 32) {
    byteVector.writeUint32((major << 5) | extendedFloat32, value as number);
  } else {
    byteVector.writeUint64((major << 5) | extendedFloat64, value);
  }
}

/**
 * @param input - JS data object.
 */
export function encode(input: any): void {
  if (input === null) {
    byteVector.write((majorSpecial << 5) | specialNull);
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
      byteVector.write((majorSpecial << 5) | (input ? specialTrue : specialFalse));
      return;
    case "number":
      if (Number.isInteger(input)) {
        input >= 0 ? encodeHeader(majorUint64, input) : encodeHeader(majorNegativeInt64, Math.abs(input) - 1);
        return;
      }
      byteVector.writeFloat64((majorSpecial << 5) | extendedFloat64, input);
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
    for (let i = 0; i < _input.length; ++i) {
      encode(_input[i]);
    }
    return;
  } else if (typeof input.byteLength === "number") {
    encodeHeader(majorUnstructuredByteString, input.length);
    byteVector.writeBytes(input);
    return;
  } else if (typeof input === "object" && "tag" in input && "value" in input && Object.keys(input).length === 2) {
    encodeHeader(majorTag, input.tag);
    encode(input.value);
    return;
  } else if (typeof input === "object") {
    const entries = [];
    for (const key in input) {
      if (input[key] !== undefined) {
        entries.push([key, input[key]]);
      }
    }
    encodeHeader(majorMap, entries.length);
    for (let i = 0; i < entries.length; i++) {
      encode(entries[i][0]);
      encode(entries[i][1]);
    }
    return;
  }

  throw new Error(`data type ${input?.constructor?.name ?? typeof input} not compatible for encoding.`);
}

const notUndef = <T>(_: T) => _ !== undefined;
