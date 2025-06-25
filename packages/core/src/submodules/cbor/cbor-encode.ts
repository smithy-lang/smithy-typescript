import { NumericValue } from "@smithy/core/serde";
import { fromUtf8 } from "@smithy/util-utf8";

import {
  alloc,
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
  tagSymbol,
  Uint64,
} from "./cbor-types";

const USE_BUFFER = typeof Buffer !== "undefined";

const initialSize = 2048;
let data: Uint8Array = alloc(initialSize);
let dataView: DataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
let cursor: number = 0;

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

function encodeHeader(major: CborMajorType, value: Uint64 | number): void {
  if (value < 24) {
    data[cursor++] = (major << 5) | (value as number);
  } else if (value < 1 << 8) {
    data[cursor++] = (major << 5) | 24;
    data[cursor++] = value as number;
  } else if (value < 1 << 16) {
    data[cursor++] = (major << 5) | extendedFloat16;
    dataView.setUint16(cursor, value as number);
    cursor += 2;
  } else if (value < 2 ** 32) {
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
 * @param _input - JS data object.
 */
export function encode(_input: any): void {
  const encodeStack = [_input];

  while (encodeStack.length) {
    const input = encodeStack.pop();

    ensureSpace(typeof input === "string" ? input.length * 4 : 64);

    if (typeof input === "string") {
      if (USE_BUFFER) {
        encodeHeader(majorUtf8String, Buffer.byteLength(input));
        cursor += (data as Buffer).write(input, cursor);
      } else {
        const bytes = fromUtf8(input);
        encodeHeader(majorUtf8String, bytes.byteLength);
        data.set(bytes, cursor);
        cursor += bytes.byteLength;
      }
      continue;
    } else if (typeof input === "number") {
      if (Number.isInteger(input)) {
        const nonNegative = input >= 0;
        const major = nonNegative ? majorUint64 : majorNegativeInt64;
        const value = nonNegative ? input : -input - 1;
        if (value < 24) {
          data[cursor++] = (major << 5) | value;
        } else if (value < 256 /* 2 ** 8 */) {
          data[cursor++] = (major << 5) | 24;
          data[cursor++] = value;
        } else if (value < 65536 /* 2 ** 16 */) {
          data[cursor++] = (major << 5) | extendedFloat16;
          data[cursor++] = (value as number) >> 8;
          data[cursor++] = value as number & 0b1111_1111;
        } else if (value < 4294967296 /* 2 ** 32 */) {
          data[cursor++] = (major << 5) | extendedFloat32;
          dataView.setUint32(cursor, value);
          cursor += 4;
        } else {
          data[cursor++] = (major << 5) | extendedFloat64;
          dataView.setBigUint64(cursor, BigInt(value));
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
      const n = Number(value);
      if (n < 24) {
        data[cursor++] = (major << 5) | n;
      } else if (n < 256 /* 2 ** 8 */) {
        data[cursor++] = (major << 5) | 24;
        data[cursor++] = n;
      } else if (n < 65536 /* 2 ** 16 */) {
        data[cursor++] = (major << 5) | extendedFloat16;
        data[cursor++] = n >> 8;
        data[cursor++] = n & 0b1111_1111;
      } else if (n < 4294967296 /* 2 ** 32 */) {
        data[cursor++] = (major << 5) | extendedFloat32;
        dataView.setUint32(cursor, n);
        cursor += 4;
      } else if (value < BigInt("18446744073709551616")) {
        data[cursor++] = (major << 5) | extendedFloat64;
        dataView.setBigUint64(cursor, value);
        cursor += 8;
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
        ensureSpace(bigIntBytes.byteLength * 2);
        data[cursor++] = nonNegative ? 0b110_00010 : 0b110_00011;

        if (USE_BUFFER) {
          encodeHeader(majorUnstructuredByteString, Buffer.byteLength(bigIntBytes));
        } else {
          encodeHeader(majorUnstructuredByteString, bigIntBytes.byteLength);
        }
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
      for (let i = input.length - 1; i >= 0; --i) {
        encodeStack.push(input[i]);
      }
      encodeHeader(majorList, input.length);
      continue;
    } else if (typeof input.byteLength === "number") {
      ensureSpace(input.length * 2);
      encodeHeader(majorUnstructuredByteString, input.length);
      data.set(input, cursor);
      cursor += input.byteLength;
      continue;
    } else if (typeof input === "object") {
      if (input instanceof NumericValue) {
        const decimalIndex = input.string.indexOf(".");
        const exponent = decimalIndex === -1 ? 0 : decimalIndex - input.string.length + 1;
        const mantissa = BigInt(input.string.replace(".", ""));

        data[cursor++] = 0b110_00100; // major 6, tag 4.

        encodeStack.push(mantissa);
        encodeStack.push(exponent);
        encodeHeader(majorList, 2);
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
      for (let i = keys.length - 1; i >= 0; --i) {
        const key = keys[i];
        encodeStack.push(input[key]);
        encodeStack.push(key);
      }
      encodeHeader(majorMap, keys.length);
      continue;
    }

    throw new Error(`data type ${input?.constructor?.name ?? typeof input} not compatible for encoding.`);
  }
}
