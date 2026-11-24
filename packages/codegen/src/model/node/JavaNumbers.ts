/**
 * Formats a JSON number lexeme the way Smithy's Java NumberNode prints it.
 * Integers print as Long or BigInteger. Decimals print as Double, or as BigDecimal when a double would lose digits.
 *
 * @internal
 */
export const javaNumberToString = (lexeme: string): string => {
  if (!/[eE.]/.test(lexeme)) {
    return BigInt(lexeme).toString();
  }
  const double = Number(lexeme);
  if (!Number.isFinite(double)) {
    return bigDecimalToString(parseDecimal(lexeme));
  }
  const exact = parseDecimal(lexeme);
  const javaDouble = doubleToString(double);
  if (compareDecimals(exact, parseDecimal(javaDouble)) === 0) {
    return javaDouble;
  }
  return bigDecimalToString(exact);
};

interface Decimal {
  unscaled: bigint;
  scale: number;
}

/**
 * Mirrors java.lang.Double#toString with shortest round-trip digits.
 */
const doubleToString = (value: number): string => {
  if (value === 0) {
    return Object.is(value, -0) ? "-0.0" : "0.0";
  }
  const sign = value < 0 ? "-" : "";
  const [mantissa, exponentText] = Math.abs(value).toExponential().split("e");
  const digits = mantissa.replace(".", "");
  const exponent = Number(exponentText);
  const magnitude = Math.abs(value);
  if (magnitude >= 1e-3 && magnitude < 1e7) {
    if (exponent >= 0) {
      const whole = digits.slice(0, exponent + 1).padEnd(exponent + 1, "0");
      const fraction = digits.slice(exponent + 1);
      return sign + whole + "." + (fraction.length > 0 ? fraction : "0");
    }
    return sign + "0." + "0".repeat(-exponent - 1) + digits;
  }
  const fraction = digits.slice(1);
  return sign + digits[0] + "." + (fraction.length > 0 ? fraction : "0") + "E" + exponent;
};

const parseDecimal = (lexeme: string): Decimal => {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(lexeme);
  if (match === null) {
    throw new Error("Invalid decimal: " + lexeme);
  }
  const [, sign, whole, fraction = "", exponent = "0"] = match;
  const magnitude = BigInt((whole + fraction).replace(/^0+(?=\d)/, "") || "0");
  return { unscaled: sign === "-" ? -magnitude : magnitude, scale: fraction.length - Number(exponent) };
};

const compareDecimals = (a: Decimal, b: Decimal): number => {
  const scale = Math.max(a.scale, b.scale);
  const left = a.unscaled * 10n ** BigInt(scale - a.scale);
  const right = b.unscaled * 10n ** BigInt(scale - b.scale);
  return left < right ? -1 : left > right ? 1 : 0;
};

/**
 * Mirrors java.math.BigDecimal#toString, which switches to scientific notation for negative scales and small values.
 */
const bigDecimalToString = ({ unscaled, scale }: Decimal): string => {
  const sign = unscaled < 0n ? "-" : "";
  const coefficient = (unscaled < 0n ? -unscaled : unscaled).toString();
  const adjusted = -scale + (coefficient.length - 1);
  if (scale >= 0 && adjusted >= -6) {
    if (scale === 0) {
      return sign + coefficient;
    }
    if (coefficient.length > scale) {
      return (
        sign + coefficient.slice(0, coefficient.length - scale) + "." + coefficient.slice(coefficient.length - scale)
      );
    }
    return sign + "0." + "0".repeat(scale - coefficient.length) + coefficient;
  }
  const rest = coefficient.length > 1 ? "." + coefficient.slice(1) : "";
  return sign + coefficient[0] + rest + "E" + (adjusted >= 0 ? "+" : "") + adjusted;
};
