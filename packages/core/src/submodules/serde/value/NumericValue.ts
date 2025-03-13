/**
 * Types which may be represented by {@link NumericValue}.
 *
 * There is currently only one option, because BigInteger and Long should
 * use JS BigInt directly, and all other numeric types can be contained in JS Number.
 *
 * @public
 */
export type NumericType = "bigDecimal";

/**
 * Serialization container for Smithy simple types that do not have a
 * direct JavaScript runtime representation.
 *
 * This container does not perform numeric mathematical operations.
 * It is a container for discerning a value's true type.
 *
 * It allows storage of numeric types not representable in JS without
 * making a decision on what numeric library to use.
 *
 * @public
 */
export class NumericValue {
  public constructor(
    public readonly string: string,
    public readonly type: NumericType
  ) {}
}

/**
 * Serde shortcut.
 * @internal
 */
export function nv(string: string): NumericValue {
  return new NumericValue(string, "bigDecimal");
}
