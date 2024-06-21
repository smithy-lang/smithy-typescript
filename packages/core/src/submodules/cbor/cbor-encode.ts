import { fromUtf8 } from "@smithy/util-utf8";

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
import { alloc } from "./cbor-types";

const USE_BUFFER = typeof Buffer !== "undefined";

type BufferWithUtf8Write = Buffer & {
  utf8Write(str: string, index: number): number;
};

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

const headerEncode: Symbol = Symbol("headerEncodeCbor");

/**
 * @param _input - JS data object.
 */
export function encode(_input: any): void {
  const encodeStack = [_input];

  while (encodeStack.length) {
    const input = encodeStack.pop();
    if (input?.headerEncode === headerEncode) {
      encodeHeader(input.major, input.count);
      continue;
    }

    ensureSpace(typeof input === "string" ? input.length * 4 : 64);

    if (typeof input === "string") {
      if (USE_BUFFER) {
        encodeHeader(majorUtf8String, Buffer.byteLength(input));
        if ((data as BufferWithUtf8Write).utf8Write) {
          cursor += (data as BufferWithUtf8Write).write(input, cursor);
        } else {
          cursor += (data as Buffer).write(input, cursor);
        }
      } else {
        const bytes = fromUtf8(input);
        encodeHeader(majorUtf8String, bytes.byteLength);
        data.set(bytes, cursor);
        cursor += bytes.byteLength;
      }
      continue;
    } else if (typeof input === "number") {
      if (Number.isInteger(input)) {
        // this section is inlined duplicate for performance.
        const major = input >= 0 ? majorUint64 : majorNegativeInt64;
        const value = input >= 0 ? input : -input - 1;
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
      const major = input >= 0 ? majorUint64 : majorNegativeInt64;
      const value = input >= 0 ? input : -input - BigInt(1);
      const n = Number(value);
      // this section is inlined duplicate for performance.
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
      } else {
        data[cursor++] = (major << 5) | extendedFloat64;
        dataView.setBigUint64(cursor, value);
        cursor += 8;
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
      encodeStack.push({
        headerEncode,
        major: majorList,
        count: input.length,
      });
      continue;
    } else if (typeof input.byteLength === "number") {
      ensureSpace(input.length * 2);
      encodeHeader(majorUnstructuredByteString, input.length);
      data.set(input, cursor);
      cursor += input.byteLength;
      continue;
    } else if (typeof input === "object" && "tag" in input && "value" in input && Object.keys(input).length === 2) {
      encodeStack.push(input.value);
      encodeStack.push({
        headerEncode,
        major: majorTag,
        count: input.tag,
      });
      continue;
    } else if (typeof input === "object") {
      const keys = Object.keys(input);
      for (let i = keys.length - 1; i >= 0; --i) {
        const key = keys[i];
        encodeStack.push(input[key]);
        encodeStack.push(key);
      }
      encodeStack.push({
        headerEncode,
        major: majorMap,
        count: keys.length,
      });
      continue;
    }

    throw new Error(`data type ${input?.constructor?.name ?? typeof input} not compatible for encoding.`);
  }
}

// function encodeString(input: string) {
// for (let i = 0; i < input.length; ++i) {
//   const c = input.charCodeAt(i);
//   const trailer = 0b1000_0000;
//
//   if (c < 128 /* byte */) {
//     data[cursor++] = c;
//   } else if (c < 2048 /* 12 bits */) {
//     // left 6 bits
//     data[cursor++] = (c >> 6) | 0b1100_00000; // 11 leading.
//     // right 6 bits
//     data[cursor++] = (c & 0b00_111111) | trailer;
//   } else if (c < 65536 /* 17 bits*/) {
//     data[cursor++] = ((c >> 12) & 0b0011_1111) | 0b1110_0000; // 111 leading.
//     data[cursor++] = ((c >> 6) & 0b0011_1111) | trailer;
//     data[cursor++] = ((c >> 0) & 0b0011_1111) | trailer;
//   } else {
//     // surrogate pair
//     i++;
//     // 1st
//     data[cursor++] = ((c >> 18) & 0b0011_1111) | 0b1111_0000; // 1111 leading.
//     data[cursor++] = ((c >> 12) & 0b0011_1111) | trailer;
//
//     // 2nd
//     data[cursor++] = ((c >> 6) & 0b0011_1111) | trailer;
//     data[cursor++] = ((c >> 0) & 0b0011_1111) | trailer;
//   }
// }
// }
