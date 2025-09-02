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
  ) {
    let dot = 0;
    for (let i = 0; i < string.length; ++i) {
      const char = string.charCodeAt(i);
      if (i === 0 && char === 45) {
        // negation prefix "-"
        continue;
      }
      if (char === 46) {
        // decimal point "."
        if (dot) {
          throw new Error("@smithy/core/serde - NumericValue must contain at most one decimal point.");
        }
        dot = 1;
        continue;
      }
      if (char < 48 || char > 57) {
        // not in 0 through 9
        throw new Error(
          `@smithy/core/serde - NumericValue must only contain [0-9], at most one decimal point ".", and an optional negation prefix "-".`
        );
      }
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
    const prototypeMatch = NumericValue.prototype.isPrototypeOf(object);
    if (prototypeMatch) {
      return prototypeMatch;
    }
    if (
      typeof _nv.string === "string" &&
      typeof _nv.type === "string" &&
      _nv.constructor?.name?.endsWith("NumericValue")
    ) {
      return true;
    }
    return prototypeMatch;
  }
}

/**
 * Serde shortcut.
 * @internal
 */
export function nv(input: string | unknown): NumericValue {
  return new NumericValue(String(input), "bigDecimal");
}
