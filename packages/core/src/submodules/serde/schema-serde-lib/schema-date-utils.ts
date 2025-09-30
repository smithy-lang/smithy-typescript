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

  // RFC3339 regex pattern
  const pattern = /^(\d{4})-(\d{2})-(\d{2})[tT](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(([zZ])|([+-])(\d{2}):(\d{2}))$/;
  const matches = pattern.exec(value);

  if (!matches) {
    throw new TypeError("Invalid RFC3339 timestamp format");
  }

  const [_, year, month, day, hour, minute, second, fraction, , isUTC, plusMinus, tzHour, tzMinute] = matches;

  let date = new Date();
  date.setUTCFullYear(+year, +month - 1, +day);
  date.setUTCHours(+hour);
  date.setUTCMinutes(+minute);
  date.setUTCSeconds(+second);
  date.setUTCMilliseconds(fraction ? Math.round(parseFloat(`0.${fraction}`) * 1000) : 0);

  if (!isUTC) {
    const offset = (plusMinus === "+" ? -1 : 1) * (+tzHour * 60 + +tzMinute) * 60000;
    date = new Date(date.getTime() + offset);
  }

  return date;
};

/**
 * @internal
 *
 * Parses a value into a Date. Returns undefined if the input is null or
 * undefined, throws an error if the input is not a string that can be parsed
 * as an RFC 7231 IMF-fixdate or obs-date.
 *
 * Input strings must conform to RFC7231 section 7.1.1.1. Fractional seconds are supported.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7231.html#section-7.1.1.1}
 *
 * @param value - the value to parse
 * @returns a Date or undefined
 */
export const _parseRfc7231DateTime = (value: unknown): Date | undefined => {
  if (value == null) {
    return void 0;
  }
  if (typeof value !== "string") {
    throw new TypeError("RFC7231 timestamps must be strings");
  }

  // RFC7231 date format: e.g., "Sun, 06 Nov 1994 08:49:37 GMT"
  const pattern =
    /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d+))? GMT$/;
  const matches = pattern.exec(value);

  if (!matches) {
    throw new TypeError("Invalid RFC7231 timestamp format");
  }

  const months: { [key: string]: number } = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };

  const [_, day, month, year, hour, minute, second, fraction] = matches;

  const date = new Date();
  date.setUTCFullYear(+year);
  date.setUTCMonth(months[month]);
  date.setUTCDate(+day);
  date.setUTCHours(+hour);
  date.setUTCMinutes(+minute);
  date.setUTCSeconds(+second);
  date.setUTCMilliseconds(fraction ? Math.round(parseFloat(`0.${fraction}`) * 1000) : 0);

  return date;
};
