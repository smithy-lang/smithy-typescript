import { byteVector } from "./ByteVector";
import { decode } from "./cbor-decode";
import { encode } from "./cbor-encode";
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
export type CborItemType =
  | undefined
  | boolean
  | number
  | bigint
  | [CborUnstructuredByteStringType, Uint64]
  | string
  | CborTagType;
export type CborTagType = {
  tag: Uint64 | number;
  value: CborValueType;
};
export type CborUnstructuredByteStringType = Uint8Array;
export type CborListType<T = any> = Array<T>;
export type CborMapType<T = any> = Record<string, T>;
export type CborCollectionType<T = any> = CborMapType<T> | CborListType<T>;

export type CborValueType = CborItemType | CborCollectionType | any;

export type CborArgumentLength = 1 | 2 | 4 | 8;
export type CborArgumentLengthOffset = 1n | 2n | 3n | 5n | 9n;
export type CborOffset = Uint64;

export type Uint8 = number;
export type Uint32 = number;
export type Uint64 = bigint;

export type Int64 = bigint;

export type Float16Binary = number;
export type Float32Binary = number;

export type CborMajorType =
  | typeof majorUint64
  | typeof majorNegativeInt64
  | typeof majorUnstructuredByteString
  | typeof majorUtf8String
  | typeof majorList
  | typeof majorMap
  | typeof majorTag
  | typeof majorSpecial;

export const majorUint64 = 0; // 0b000
export const majorNegativeInt64 = 1; // 0b001
export const majorUnstructuredByteString = 2; // 0b010
export const majorUtf8String = 3; // 0b011
export const majorList = 4; // 0b100
export const majorMap = 5; // 0b101
export const majorTag = 6; // 0b110
export const majorSpecial = 7; // 0b111

export const specialFalse = 20; // 0b10100
export const specialTrue = 21; // 0b10101
export const specialNull = 22; // 0b10110
export const specialUndefined = 23; // 0b10111
export const specialOneByte = 24; // 0b11000
export const specialFloat16 = 25; // 0b11001
export const specialFloat32 = 26; // 0b11010
export const specialFloat64 = 27; // 0b11011

export const minorIndefinite = 31; // 0b11111

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
