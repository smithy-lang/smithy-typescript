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
 * @internal
 */
const format = /^-?\d*(\.\d+)?$/;

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
  ) {
    if (!format.test(string)) {
      throw new Error(
        `@smithy/core/serde - NumericValue must only contain [0-9], at most one decimal point ".", and an optional negation prefix "-".`
      );
    }
  }

  public toString() {
    return this.string;
  }

  public static [Symbol.hasInstance](object: unknown) {
    if (!object || typeof object !== "object") {
      return false;
    }
    const _nv = object as NumericValue;
    return NumericValue.prototype.isPrototypeOf(object) || (_nv.type === "bigDecimal" && format.test(_nv.string));
  }
}

/**
 * Serde shortcut.
 * @internal
 */
export function nv(input: string | unknown): NumericValue {
  return new NumericValue(String(input), "bigDecimal");
}
