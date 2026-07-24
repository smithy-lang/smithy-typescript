import { SerdeContext } from "@smithy/core/protocols";
import { NormalizedSchema } from "@smithy/core/schema";
import { NumericValue, _parseEpochTimestamp, nv } from "@smithy/core/serde";
import type { DocumentSchema, Schema, ShapeDeserializer } from "@smithy/types";

import {
  extendedFloat16,
  extendedFloat32,
  extendedFloat64,
  extendedOneByte,
  majorList,
  majorMap,
  majorNegativeInt64,
  majorSpecial,
  majorTag,
  majorUint64,
  majorUnstructuredByteString,
  majorUtf8String,
  minorIndefinite,
  specialFalse,
  specialNull,
  specialTrue,
  specialUndefined,
  type Uint8,
} from "./cbor-types";

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Single-pass CBOR deserializer that reads bytes and applies Smithy schema
 * transformations in one traversal using module-level state.
 *
 * @internal
 */
export class SinglePassCborShapeDeserializer extends SerdeContext implements ShapeDeserializer<Uint8Array> {
  public read(schema: Schema, bytes: Uint8Array): any {
    payload = bytes;
    isBuffer = USE_BUFFER && bytes instanceof Buffer;
    dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    pos = 0;
    end = bytes.length;
    cacheEpoch = (cacheEpoch + 1) & 0xffff;
    return readValue(NormalizedSchema.of(schema));
  }

  /**
   * Deserialize a pre-decoded JS object per schema.
   * Used by protocol error handling which passes pre-decoded objects.
   *
   * @internal
   */
  public readObjectValue(_schema: Schema, value: any): any {
    return transformObject(NormalizedSchema.of(_schema), value);
  }
}

// ─── Module-level decoder state ───────────────────────────────────────────────

const USE_BUFFER = typeof Buffer !== "undefined";
const textDecoder = new TextDecoder();

let payload: Uint8Array = new Uint8Array(0);
let isBuffer = false;
let dataView: DataView = new DataView(new ArrayBuffer(0));
let pos = 0;
let end = 0;

const STRING_CACHE_SIZE = 2048;
const stringCache: (string | undefined)[] = new Array(STRING_CACHE_SIZE);
const stringCacheEpochs = new Uint16Array(STRING_CACHE_SIZE);
let cacheEpoch = 0;

// ─── Schema-aware deserialization ─────────────────────────────────────────────

function readValue(ns: NormalizedSchema): any {
  if (pos >= end) {
    throw new Error("unexpected end of CBOR payload.");
  }

  const major = (payload[pos] & 0b1110_0000) >> 5;
  const minor = payload[pos] & 0b0001_1111;

  if (minor === minorIndefinite && major >= 2 && major <= 5) {
    return readIndefinite(ns, major);
  }

  switch (major) {
    case majorUint64:
      return readUnsignedInt();
    case majorNegativeInt64:
      return readNegativeInt();
    case majorUnstructuredByteString:
      return readByteString();
    case majorUtf8String:
      return readUtf8String();
    case majorList:
      return readList(ns);
    case majorMap:
      return readMap(ns);
    case majorTag:
      return readTag(ns);
    case majorSpecial:
      return readSpecial();
    default:
      throw new Error(`unexpected CBOR major type ${major}.`);
  }
}

function readList(ns: NormalizedSchema): any[] {
  const count = decodeCount();
  const memberSchema = ns.isListSchema() ? ns.getValueSchema() : ns;
  const list = Array(count);
  for (let i = 0; i < count; ++i) {
    list[i] = readValue(memberSchema);
  }
  return list;
}

function readMap(ns: NormalizedSchema): any {
  const count = decodeCount();

  if (ns.isStructSchema()) {
    return readStruct(ns, count);
  }

  const valueSchema = ns.isMapSchema() ? ns.getValueSchema() : ns;
  const map: Record<string, any> = {};
  for (let i = 0; i < count; ++i) {
    const key = readUtf8String();
    map[key] = readValue(valueSchema);
  }
  return map;
}

function readStruct(ns: NormalizedSchema, count: number): any {
  const isUnion = ns.isUnionSchema();
  const cache = ns.structIteratorCbor!();
  const { memberSchemas, encodedKeys, memberNames } = cache;
  const z = encodedKeys.length;
  const result: Record<string, any> = {};
  let unknownKey: string | undefined;
  let unknownValue: any;
  let unknownCount = 0;
  let hint = 0;

  for (let i = 0; i < count; ++i) {
    const matchIdx = matchStructKey(encodedKeys, z, hint);
    if (matchIdx >= 0) {
      hint = matchIdx + 1;
      if (hint >= z) {
        hint = 0;
      }
      const val = readValue(memberSchemas[matchIdx]);
      if (val != null) {
        result[memberNames[matchIdx]] = val;
      }
    } else {
      const key = readUtf8String();
      const val = readValue(NormalizedSchema.of(15 satisfies DocumentSchema));
      if (key !== "__type") {
        unknownKey = key;
        unknownValue = val;
        ++unknownCount;
      }
    }
  }

  if (isUnion) {
    let resultEmpty = true;
    for (const _ in result) {
      resultEmpty = false;
      break;
    }
    if (resultEmpty && unknownCount === 1) {
      result.$unknown = [unknownKey!, unknownValue];
    }
  }

  return result;
}

function readTag(ns: NormalizedSchema): any {
  const tagNum = decodeArgument();
  const tagNumber = typeof tagNum === "bigint" ? Number(tagNum) : tagNum;

  if (tagNumber === 1) {
    const docSchema = NormalizedSchema.of(15 satisfies DocumentSchema);
    const epochValue = readValue(docSchema);
    return _parseEpochTimestamp(epochValue);
  }

  if (tagNumber === 2 || tagNumber === 3) {
    const byteStr = readByteString();
    let b = BigInt(0);
    for (let i = 0; i < byteStr.length; ++i) {
      b = (b << BigInt(8)) | BigInt(byteStr[i]);
    }
    return tagNumber === 3 ? -b - BigInt(1) : b;
  }

  if (tagNumber === 4) {
    const docSchema = NormalizedSchema.of(15 satisfies DocumentSchema);
    const pair = readValue(docSchema) as [number, number | bigint];
    const [exponent, mantissa] = pair;
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

    return nv(numericString);
  }

  const docSchema = NormalizedSchema.of(15 satisfies DocumentSchema);
  const innerValue = readValue(docSchema);
  return { tag: castBigInt(tagNum), value: innerValue };
}

// ─── Indefinite-length containers ─────────────────────────────────────────────

function readIndefinite(ns: NormalizedSchema, major: number): any {
  switch (major) {
    case majorUtf8String:
      return readUtf8StringIndefinite();
    case majorUnstructuredByteString:
      return readByteStringIndefinite();
    case majorList:
      return readListIndefinite(ns);
    case majorMap:
      return readMapIndefinite(ns);
    default:
      throw new Error(`unexpected indefinite length for major ${major}.`);
  }
}

function readUtf8StringIndefinite(): string {
  pos += 1;
  const chunks: Uint8Array[] = [];
  let totalLen = 0;

  while (pos < end) {
    if (payload[pos] === 0xff) {
      pos += 1;
      const combined = new Uint8Array(totalLen);
      let offset = 0;
      for (let i = 0; i < chunks.length; ++i) {
        combined.set(chunks[i], offset);
        offset += chunks[i].length;
      }
      if (USE_BUFFER) {
        return Buffer.from(combined.buffer, combined.byteOffset, combined.byteLength).toString("utf-8");
      }
      return textDecoder.decode(combined);
    }
    const bytes = readByteString();
    chunks.push(bytes);
    totalLen += bytes.length;
  }
  throw new Error("expected break marker.");
}

function readByteStringIndefinite(): Uint8Array {
  pos += 1;
  const chunks: Uint8Array[] = [];
  let totalLen = 0;

  while (pos < end) {
    if (payload[pos] === 0xff) {
      pos += 1;
      const combined = new Uint8Array(totalLen);
      let offset = 0;
      for (let i = 0; i < chunks.length; ++i) {
        combined.set(chunks[i], offset);
        offset += chunks[i].length;
      }
      return combined;
    }
    const bytes = readByteString();
    chunks.push(bytes);
    totalLen += bytes.length;
  }
  throw new Error("expected break marker.");
}

function readListIndefinite(ns: NormalizedSchema): any[] {
  pos += 1;
  const memberSchema = ns.isListSchema() ? ns.getValueSchema() : ns;
  const list: any[] = [];

  while (pos < end) {
    if (payload[pos] === 0xff) {
      pos += 1;
      return list;
    }
    list.push(readValue(memberSchema));
  }
  throw new Error("expected break marker.");
}

function readMapIndefinite(ns: NormalizedSchema): any {
  pos += 1;

  if (ns.isStructSchema()) {
    const cache = ns.structIteratorCbor!();
    const { memberSchemas, encodedKeys, memberNames } = cache;
    const z = encodedKeys.length;
    const isUnion = ns.isUnionSchema();
    const result: Record<string, any> = {};
    let unknownKey: string | undefined;
    let unknownValue: any;
    let unknownCount = 0;
    let hint = 0;

    while (pos < end) {
      if (payload[pos] === 0xff) {
        pos += 1;
        if (isUnion) {
          let resultEmpty = true;
          for (const _ in result) {
            resultEmpty = false;
            break;
          }
          if (resultEmpty && unknownCount === 1) {
            result.$unknown = [unknownKey!, unknownValue];
          }
        }
        return result;
      }

      const matchIdx = matchStructKey(encodedKeys, z, hint);
      if (matchIdx >= 0) {
        hint = matchIdx + 1;
        if (hint >= z) {
          hint = 0;
        }
        const val = readValue(memberSchemas[matchIdx]);
        if (val != null) {
          result[memberNames[matchIdx]] = val;
        }
      } else {
        const key = readUtf8String();
        const val = readValue(NormalizedSchema.of(15 satisfies DocumentSchema));
        if (key !== "__type") {
          unknownKey = key;
          unknownValue = val;
          ++unknownCount;
        }
      }
    }
    throw new Error("expected break marker.");
  }

  const valueSchema = ns.isMapSchema() ? ns.getValueSchema() : ns;
  const map: Record<string, any> = {};

  while (pos < end) {
    if (payload[pos] === 0xff) {
      pos += 1;
      return map;
    }
    const key = readUtf8String();
    map[key] = readValue(valueSchema);
  }
  throw new Error("expected break marker.");
}

// ─── Struct key byte-matching ─────────────────────────────────────────────────

function matchStructKey(encodedKeys: Uint8Array[], z: number, hint: number): number {
  const hintKey = encodedKeys[hint];
  if (pos + hintKey.length <= end && bytesMatch(pos, hintKey)) {
    pos += hintKey.length;
    return hint;
  }

  for (let i = 0; i < z; ++i) {
    if (i === hint) {
      continue;
    }
    const ek = encodedKeys[i];
    if (pos + ek.length <= end && bytesMatch(pos, ek)) {
      pos += ek.length;
      return i;
    }
  }

  return -1;
}

function bytesMatch(at: number, expected: Uint8Array): boolean {
  const len = expected.length;
  if (payload[at] !== expected[0]) {
    return false;
  }
  for (let i = 1; i < len; ++i) {
    if (payload[at + i] !== expected[i]) {
      return false;
    }
  }
  return true;
}

// ─── CBOR decoding primitives ─────────────────────────────────────────────────

function decodeArgument(): number | bigint {
  const minor = payload[pos] & 0b0001_1111;

  if (minor < 24) {
    pos += 1;
    return minor;
  }

  switch (minor) {
    case extendedOneByte:
      if (end - pos < 2) {
        overflow(1);
      }
      pos += 2;
      return payload[pos - 1];
    case extendedFloat16:
      if (end - pos < 3) {
        overflow(2);
      }
      pos += 3;
      return dataView.getUint16(pos - 2);
    case extendedFloat32:
      if (end - pos < 5) {
        overflow(4);
      }
      pos += 5;
      return dataView.getUint32(pos - 4);
    case extendedFloat64: {
      if (end - pos < 9) {
        overflow(8);
      }
      pos += 9;
      const hi = dataView.getUint32(pos - 8);
      if (hi < 0x00200000) {
        return hi * 4294967296 + dataView.getUint32(pos - 4);
      }
      return dataView.getBigUint64(pos - 8);
    }
    default:
      throw new Error(`unexpected minor value ${minor}.`);
  }
}

function decodeCount(): number {
  const val = decodeArgument();
  return typeof val === "bigint" ? Number(val) : val;
}

function readUnsignedInt(): number | bigint {
  const val = decodeArgument();
  return castBigInt(val);
}

function readNegativeInt(): number | bigint {
  const val = decodeArgument();
  if (typeof val === "bigint") {
    return BigInt(-1) - val;
  }
  return -1 - val;
}

function readByteString(): Uint8Array {
  const length = decodeCount();
  if (end - pos < length) {
    overflow(length);
  }
  const start = pos;
  pos += length;
  return payload.subarray(start, start + length);
}

function readUtf8String(): string {
  const length = decodeCount();
  if (end - pos < length) {
    overflow(length);
  }
  const start = pos;
  pos += length;

  if (length < 24) {
    return decodeUtf8Cached(start, length);
  }
  if (isBuffer) {
    return (payload as Buffer).toString("utf-8", start, start + length);
  }
  return textDecoder.decode(payload.subarray(start, start + length));
}

function decodeUtf8Cached(at: number, length: number): string {
  let h = length;
  for (let i = 0; i < length; ++i) {
    h = (h * 31 + payload[at + i]) | 0;
  }
  const slot = (h >>> 0) & (STRING_CACHE_SIZE - 1);
  const cached = stringCache[slot];

  if (cached !== undefined && cached.length === length) {
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

  const result = isBuffer
    ? (payload as Buffer).toString("utf-8", at, at + length)
    : textDecoder.decode(payload.subarray(at, at + length));

  if (stringCacheEpochs[slot] !== cacheEpoch) {
    stringCache[slot] = result;
    stringCacheEpochs[slot] = cacheEpoch;
  }

  return result;
}

function readSpecial(): any {
  const p = pos;
  const minor = payload[p] & 0b0001_1111;

  switch (minor) {
    case specialTrue:
      pos = p + 1;
      return true;
    case specialFalse:
      pos = p + 1;
      return false;
    case specialNull:
      pos = p + 1;
      return null;
    case specialUndefined:
      pos = p + 1;
      return null;
    case extendedFloat16: {
      if (end - p < 3) {
        overflow(2);
      }
      pos = p + 3;
      return bytesToFloat16(payload[p + 1], payload[p + 2]);
    }
    case extendedFloat32: {
      if (end - p < 5) {
        overflow(4);
      }
      pos = p + 5;
      return dataView.getFloat32(p + 1);
    }
    case extendedFloat64: {
      if (end - p < 9) {
        overflow(8);
      }
      pos = p + 9;
      return dataView.getFloat64(p + 1);
    }
    default:
      throw new Error(`unexpected minor value ${minor} for major 7.`);
  }
}

function bytesToFloat16(a: Uint8, b: Uint8): number {
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

function castBigInt(value: bigint | number): number | bigint {
  if (typeof value === "number") {
    return value;
  }
  const num = Number(value);
  if (Number.MIN_SAFE_INTEGER <= num && num <= Number.MAX_SAFE_INTEGER) {
    return num;
  }
  return value;
}

function overflow(n: number): never {
  throw new Error(`CBOR: length ${n} greater than remaining buffer length.`);
}

// ─── Fallback: transform pre-decoded objects ──────────────────────────────────

function transformObject(ns: NormalizedSchema, value: any): any {
  if (ns.isTimestampSchema()) {
    if (typeof value === "number") {
      return _parseEpochTimestamp(value);
    }
    if (typeof value === "object" && value !== null) {
      if (value.tag === 1 && "value" in value) {
        return _parseEpochTimestamp(value.value);
      }
    }
  }

  if (ns.isBlobSchema()) {
    return value as Uint8Array | undefined;
  }

  if (
    typeof value === "undefined" ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string" ||
    typeof value === "bigint" ||
    typeof value === "symbol"
  ) {
    return value;
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  if ("byteLength" in value) {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  if (value instanceof NumericValue) {
    return value;
  }
  if (ns.isDocumentSchema()) {
    return value;
  }

  if (ns.isListSchema()) {
    const memberSchema = ns.getValueSchema();
    const out: any[] = [];
    for (const item of value) {
      out.push(transformObject(memberSchema, item));
    }
    return out;
  }

  const newObject: Record<string, any> = {};

  if (ns.isMapSchema()) {
    const targetSchema = ns.getValueSchema();
    for (const key in value) {
      newObject[key] = transformObject(targetSchema, value[key]);
    }
  } else if (ns.isStructSchema()) {
    const isUnion = ns.isUnionSchema();
    let keys: Set<string> | undefined;
    if (isUnion) {
      keys = new Set<string>();
      for (const k in value) {
        if (k !== "__type") {
          keys.add(k);
        }
      }
    }
    for (const [key, memberSchema] of ns.structIterator()) {
      if (isUnion) {
        keys!.delete(key);
      }
      if (value[key] != null) {
        newObject[key] = transformObject(memberSchema, value[key]);
      }
    }
    if (isUnion && keys?.size === 1) {
      let newObjectEmpty = true;
      for (const _ in newObject) {
        newObjectEmpty = false;
        break;
      }
      if (newObjectEmpty) {
        const k = keys!.values().next().value as string;
        newObject.$unknown = [k, value[k]];
      }
    } else if (typeof value.__type === "string") {
      for (const k in value) {
        if (!(k in newObject)) {
          newObject[k] = value[k];
        }
      }
    }
  }

  return newObject;
}
