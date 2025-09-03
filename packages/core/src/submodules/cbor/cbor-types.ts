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
  [tagSymbol]: true;
};
export type CborUnstructuredByteStringType = Uint8Array;
export type CborListType<T = any> = Array<T>;
export type CborMapType<T = any> = Record<string, T>;
export type CborCollectionType<T = any> = CborMapType<T> | CborListType<T>;

export type CborValueType = CborItemType | CborCollectionType | any;

export type CborArgumentLength = 1 | 2 | 4 | 8;
export type CborArgumentLengthOffset = 1 | 2 | 3 | 5 | 9;
export type CborOffset = number;

export type Uint8 = number;
export type Uint32 = number;
export type Uint64 = bigint;
export type Float32 = number;

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

export const extendedOneByte = 24; // 0b11000
export const extendedFloat16 = 25; // 0b11001
export const extendedFloat32 = 26; // 0b11010
export const extendedFloat64 = 27; // 0b11011

export const minorIndefinite = 31; // 0b11111

export function alloc(size: number): Uint8Array {
  return typeof Buffer !== "undefined" ? Buffer.alloc(size) : new Uint8Array(size);
}

/**
 * @public
 *
 * The presence of this symbol as an object key indicates it should be considered a tag
 * for CBOR serialization purposes.
 *
 * The object must also have the properties "tag" and "value".
 */
export const tagSymbol = Symbol("@smithy/core/cbor::tagSymbol");

/**
 * @public
 * Applies the tag symbol to the object.
 */
export function tag(data: { tag: number | bigint; value: any; [tagSymbol]?: true }): {
  tag: number | bigint;
  value: any;
  [tagSymbol]: true;
} {
  data[tagSymbol] = true;
  return data as typeof data & { [tagSymbol]: true };
}
