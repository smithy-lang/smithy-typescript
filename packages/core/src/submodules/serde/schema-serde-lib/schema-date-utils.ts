const ddd = `(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:[ne|u?r]?s?day)?`;
const mmm = `(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)`;
const time = `(\\d?\\d):(\\d{2}):(\\d{2})(?:\\.(\\d+))?`;
const date = `(\\d?\\d)`;
const year = `(\\d{4})`;

const RFC3339_WITH_OFFSET = new RegExp(
  /^(\d{4})-(\d\d)-(\d\d)[tT](\d\d):(\d\d):(\d\d)(\.(\d+))?(([-+]\d\d:\d\d)|[zZ])$/
);
const IMF_FIXDATE = new RegExp(`^${ddd}, ${date} ${mmm} ${year} ${time} GMT$`);
const RFC_850_DATE = new RegExp(`^${ddd}, ${date}-${mmm}-(\\d\\d) ${time} GMT$`);
const ASC_TIME = new RegExp(`^${ddd} ${mmm} ( [1-9]|\\d\\d) ${time} ${year}$`);

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * @internal
 *
 * Parses a value into a Date. Returns undefined if the input is null or
 * undefined, throws an error if the input is not a number or a parseable string.
 *
 * Input strings must be an integer or floating point number. Fractional seconds are supported.
 *
 * @param value - the value to parse
 * @returns a Date or undefined
 */
export const _parseEpochTimestamp = (value: unknown): Date | undefined => {
  if (value == null) {
    return void 0;
  }
  let num: number = NaN;
  if (typeof value === "number") {
    num = value;
  } else if (typeof value === "string") {
    if (!/^-?\d*\.?\d+$/.test(value)) {
      throw new TypeError(`parseEpochTimestamp - numeric string invalid.`);
    }
    num = Number.parseFloat(value);
  } else if (typeof value === "object" && (value as { tag: number; value: number }).tag === 1) {
    // timestamp is a CBOR tag type.
    num = (value as { tag: number; value: number }).value;
  }
  if (isNaN(num) || Math.abs(num) === Infinity) {
    throw new TypeError("Epoch timestamps must be valid finite numbers.");
  }
  return new Date(Math.round(num * 1000));
};

/**
 * @internal
 *
 * Parses a value into a Date. Returns undefined if the input is null or
 * undefined, throws an error if the input is not a string that can be parsed
 * as an RFC 3339 date.
 *
 * Input strings must conform to RFC3339 section 5.6, and can have a UTC
 * offset. Fractional precision is supported.
 *
 * @see {@link https://xml2rfc.tools.ietf.org/public/rfc/html/rfc3339.html#anchor14}
 *
 * @param value - the value to parse
 * @returns a Date or undefined
 */
export const _parseRfc3339DateTimeWithOffset = (value: unknown): Date | undefined => {
  if (value == null) {
    return void 0;
  }
  if (typeof value !== "string") {
    throw new TypeError("RFC3339 timestamps must be strings");
  }

  const matches = RFC3339_WITH_OFFSET.exec(value);

  if (!matches) {
    throw new TypeError(`Invalid RFC3339 timestamp format ${value}`);
  }

  const [, yearStr, monthStr, dayStr, hours, minutes, seconds, , ms, offsetStr] = matches;

  range(monthStr, 1, 12);
  range(dayStr, 1, 31);
  range(hours, 0, 23);
  range(minutes, 0, 59);
  range(seconds, 0, 60); // leap second

  const date = new Date(
    Date.UTC(
      Number(yearStr),
      Number(monthStr) - 1,
      Number(dayStr),
      Number(hours),
      Number(minutes),
      Number(seconds),
      Number(ms) ? Math.round(parseFloat(`0.${ms}`) * 1000) : 0
    )
  );
  date.setUTCFullYear(Number(yearStr));

  if (offsetStr.toUpperCase() != "Z") {
    const [, sign, offsetH, offsetM] = /([+-])(\d\d):(\d\d)/.exec(offsetStr) || [void 0, "+", 0, 0];
    const scalar = sign === "-" ? 1 : -1;
    date.setTime(date.getTime() + scalar * (Number(offsetH) * 60 * 60 * 1000 + Number(offsetM) * 60 * 1000));
  }

  return date;
};

/**
 * @internal
 *
 * Parses a value into a Date. Returns undefined if the input is null or
 * undefined, throws an error if the input is not a string that can be parsed
 * as an RFC 7231 date.
 *
 * Input strings must conform to RFC7231 section 7.1.1.1. Fractional seconds are supported.
 *
 * RFC 850 and unix asctime formats are also accepted.
 * todo: practically speaking, are RFC 850 and asctime even used anymore?
 * todo: can we remove those parts?
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7231.html#section-7.1.1.1}
 *
 * @param value - the value to parse.
 * @returns a Date or undefined.
 */
export const _parseRfc7231DateTime = (value: unknown): Date | undefined => {
  if (value == null) {
    return void 0;
  }
  if (typeof value !== "string") {
    throw new TypeError("RFC7231 timestamps must be strings.");
  }

  let day!: string;
  let month!: string;
  let year!: string;
  let hour!: string;
  let minute!: string;
  let second!: string;
  let fraction!: string;

  let matches: string[] | null;
  if ((matches = IMF_FIXDATE.exec(value))) {
    // "Mon, 25 Dec 2077 23:59:59 GMT"
    [, day, month, year, hour, minute, second, fraction] = matches;
  } else if ((matches = RFC_850_DATE.exec(value))) {
    // "Monday, 25-Dec-77 23:59:59 GMT"
    [, day, month, year, hour, minute, second, fraction] = matches;
    year = (Number(year) + 1900).toString();
  } else if ((matches = ASC_TIME.exec(value))) {
    // "Mon Dec 25 23:59:59 2077"
    [, month, day, hour, minute, second, fraction, year] = matches;
  }

  if (year && second) {
    const timestamp = Date.UTC(
      Number(year),
      months.indexOf(month),
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      fraction ? Math.round(parseFloat(`0.${fraction}`) * 1000) : 0
    );
    range(day, 1, 31);
    range(hour, 0, 23);
    range(minute, 0, 59);
    range(second, 0, 60); // leap second
    const date = new Date(timestamp);
    date.setUTCFullYear(Number(year));
    return date;
  }

  throw new TypeError(`Invalid RFC7231 date-time value ${value}.`);
};

/**
 * @internal
 */
function range(v: number | string, min: number, max: number): void {
  const _v = Number(v);
  if (_v < min || _v > max) {
    throw new Error(`Value ${_v} out of range [${min}, ${max}]`);
  }
}
