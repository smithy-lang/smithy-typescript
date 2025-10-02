import { describe, expect, it } from "vitest";

import { _parseEpochTimestamp, _parseRfc3339DateTimeWithOffset, _parseRfc7231DateTime } from "./schema-date-utils";

const millisecond = 1;
const second = 1000 * millisecond;
const minute = 60 * second;
const hour = 60 * minute;
const day = 24 * hour;
const year = 365 * day;

describe("_parseEpochTimestamp", () => {
  it("should parse numeric timestamps", () => {
    expect(_parseEpochTimestamp(1234567890)).toEqual(new Date(1234567890000));
    expect(_parseEpochTimestamp(1234567890.123)).toEqual(new Date(1234567890123));
    expect(_parseEpochTimestamp(1234567890.123456)).toEqual(new Date(1234567890123));
  });

  it("should parse string timestamps", () => {
    expect(_parseEpochTimestamp("1234567890")).toEqual(new Date(1234567890000));
    expect(_parseEpochTimestamp("1234567890.123")).toEqual(new Date(1234567890123));
    expect(_parseEpochTimestamp("1234567890.123456")).toEqual(new Date(1234567890123));
  });

  it("should parse CBOR tag timestamps", () => {
    expect(_parseEpochTimestamp({ tag: 1, value: 1234567890 })).toEqual(new Date(1234567890000));
    expect(_parseEpochTimestamp({ tag: 1, value: 1234567890.123 })).toEqual(new Date(1234567890123));
    expect(_parseEpochTimestamp({ tag: 1, value: 1234567890.123456 })).toEqual(new Date(1234567890123));
  });

  it("should return undefined for null/undefined", () => {
    expect(_parseEpochTimestamp(null)).toBeUndefined();
    expect(_parseEpochTimestamp(undefined)).toBeUndefined();
  });

  it("should throw for invalid numbers", () => {
    expect(() => _parseEpochTimestamp("abc")).toThrow();
    expect(() => _parseEpochTimestamp(Infinity)).toThrow();
    expect(() => _parseEpochTimestamp(NaN)).toThrow();
  });
});

describe("_parseRfc3339DateTimeWithOffset", () => {
  it("should parse UTC timestamps", () => {
    expect(_parseRfc3339DateTimeWithOffset("2077-12-25T00:00:00Z")).toEqual(new Date(3407616000_000));
    expect(_parseRfc3339DateTimeWithOffset("2077-12-25T12:12:12.01Z")).toEqual(
      new Date(3407616000_000 + 12 * hour + 12 * minute + 12 * second + 10 * millisecond)
    );
    expect(_parseRfc3339DateTimeWithOffset("2077-12-25T23:59:59.999Z")).toEqual(
      new Date(3407616000_000 + 23 * hour + 59 * minute + 59 * second + 999 * millisecond)
    );
  });

  it("should parse timestamps with positive offset", () => {
    expect(_parseRfc3339DateTimeWithOffset("2077-12-25T00:00:00-04:30")).toEqual(new Date(3407616000_000 + 4.5 * hour));
    expect(_parseRfc3339DateTimeWithOffset("2077-12-25T12:12:12.01-04:30")).toEqual(
      new Date(3407616000_000 + 12 * hour + 12 * minute + 12 * second + 10 * millisecond + 4.5 * hour)
    );
    expect(_parseRfc3339DateTimeWithOffset("2077-12-25T23:59:59.999-04:30")).toEqual(
      new Date(3407616000_000 + 23 * hour + 59 * minute + 59 * second + 999 * millisecond + 4.5 * hour)
    );
  });

  it("should parse timestamps with negative offset", () => {
    expect(_parseRfc3339DateTimeWithOffset("2077-12-25T00:00:00+05:00")).toEqual(new Date(3407616000_000 - 5 * hour));
    expect(_parseRfc3339DateTimeWithOffset("2077-12-25T12:12:12.01+05:00")).toEqual(
      new Date(3407616000_000 + 12 * hour + 12 * minute + 12 * second + 10 * millisecond - 5 * hour)
    );
    expect(_parseRfc3339DateTimeWithOffset("2077-12-25T23:59:59.999+05:00")).toEqual(
      new Date(3407616000_000 + 23 * hour + 59 * minute + 59 * second + 999 * millisecond - 5 * hour)
    );
  });

  it("should parse timestamps with fractional seconds", () => {
    expect(_parseRfc3339DateTimeWithOffset("2023-12-25T12:00:00.123Z")).toEqual(new Date("2023-12-25T12:00:00.123Z"));
  });

  it("should return undefined for null/undefined", () => {
    expect(_parseRfc3339DateTimeWithOffset(null)).toBeUndefined();
    expect(_parseRfc3339DateTimeWithOffset(undefined)).toBeUndefined();
  });

  it("should throw for invalid formats", () => {
    expect(() => _parseRfc3339DateTimeWithOffset("2023-12-25")).toThrow();
    expect(() => _parseRfc3339DateTimeWithOffset(123)).toThrow();
  });
});

describe("_parseRfc7231DateTime", () => {
  it("should parse RFC7231 timestamps", () => {
    expect(_parseRfc7231DateTime("Mon, 31 Dec 2077 23:59:30 GMT")).toEqual(new Date(3408220800000 - 30 * second));
  });

  it("should parse timestamps with fractional seconds", () => {
    expect(_parseRfc7231DateTime("Mon, 31 Dec 2077 23:59:30.123 GMT")).toEqual(
      new Date(3408220800000 - 29 * second - 877 * millisecond)
    );
  });

  it("should parse RFC850 timestamps", () => {
    expect(_parseRfc7231DateTime("Monday, 31-Dec-77 23:59:30 GMT")).toEqual(
      new Date(3408220800000 - 100 * year - 25 * day - 30 * second)
    );
  });

  it("should parse asctime timestamps", () => {
    expect(_parseRfc7231DateTime("Mon Dec 31 23:59:30 2077")).toEqual(new Date(3408220800000 - 30 * second));
  });

  it("should return undefined for null/undefined", () => {
    expect(_parseRfc7231DateTime(null)).toBeUndefined();
    expect(_parseRfc7231DateTime(undefined)).toBeUndefined();
  });

  it("should throw for invalid formats", () => {
    expect(() => _parseRfc7231DateTime("2077-12-25T08:49:37Z")).toThrow();
    expect(() => _parseRfc7231DateTime(123)).toThrow();
    expect(() => _parseRfc7231DateTime("Invalid, 25 Dec 2077 08:49:37 GMT")).toThrow();
  });
});

// some invalid values are not validated client side
// because of excessive code requirements.
const invalidRfc3339DateTimes = [
  "85-04-12T23:20:50.52Z", // Year must be 4 digits
  "985-04-12T23:20:50.52Z", // Year must be 4 digits
  "1985-13-12T23:20:50.52Z", // Month cannot be greater than 12
  "1985-00-12T23:20:50.52Z", // Month cannot be 0
  "1985-4-12T23:20:50.52Z", // Month must be 2 digits with leading zero
  "1985-04-32T23:20:50.52Z", // Day cannot be greater than 31
  "1985-04-00T23:20:50.52Z", // Day cannot be 0
  "1985-04-05T24:20:50.52Z", // Hours cannot be greater than 23
  "1985-04-05T23:61:50.52Z", // Minutes cannot be greater than 59
  "1985-04-05T23:20:61.52Z", // Seconds cannot be greater than 59 (except leap second)
  // "1985-04-31T23:20:50.52Z", // April only has 30 days
  // "2005-02-29T15:59:59Z", // 2005 was not a leap year, so February only had 28 days
  "1996-12-19T16:39:57", // Missing timezone offset
  "Mon, 31 Dec 1990 15:59:60 GMT", // RFC 7231 format, not RFC 3339
  "Monday, 31-Dec-90 15:59:60 GMT", // RFC 7231 format, not RFC 3339
  "Mon Dec 31 15:59:60 1990", // RFC 7231 format, not RFC 3339
  "1985-04-12T23:20:50.52Z1985-04-12T23:20:50.52Z", // Contains multiple timestamps
  "1985-04-12T23:20:50.52ZA", // Contains invalid characters after timezone
  "A1985-04-12T23:20:50.52Z", // Contains invalid characters before timestamp
];

describe("parseRfc3339DateTime", () => {
  it.each([null, undefined])("returns undefined for %s", (value) => {
    expect(_parseRfc3339DateTimeWithOffset(value)).toBeUndefined();
  });

  describe("parses properly formatted dates", () => {
    it("with fractional seconds", () => {
      expect(_parseRfc3339DateTimeWithOffset("1985-04-12T23:20:50.52Z")).toEqual(
        new Date(Date.UTC(1985, 3, 12, 23, 20, 50, 520))
      );
    });
    it("without fractional seconds", () => {
      expect(_parseRfc3339DateTimeWithOffset("1985-04-12T23:20:50Z")).toEqual(
        new Date(Date.UTC(1985, 3, 12, 23, 20, 50, 0))
      );
    });
    it("with leap seconds", () => {
      expect(_parseRfc3339DateTimeWithOffset("1990-12-31T15:59:60Z")).toEqual(
        new Date(Date.UTC(1990, 11, 31, 15, 59, 60, 0))
      );
    });
    it("with leap days", () => {
      expect(_parseRfc3339DateTimeWithOffset("2004-02-29T15:59:59Z")).toEqual(
        new Date(Date.UTC(2004, 1, 29, 15, 59, 59, 0))
      );
    });
    it("with leading zeroes", () => {
      expect(_parseRfc3339DateTimeWithOffset("0004-02-09T05:09:09.09Z")).toEqual(new Date(-62037600650910));
      expect(_parseRfc3339DateTimeWithOffset("0004-02-09T00:00:00.00Z")).toEqual(new Date(-62037619200000));
    });
  });

  it.each(invalidRfc3339DateTimes)("rejects %s", (value) => {
    expect(() => _parseRfc3339DateTimeWithOffset(value)).toThrowError();
  });
});

describe("parseRfc3339DateTimeWithOffset", () => {
  it.each([null, undefined])("returns undefined for %s", (value) => {
    expect(_parseRfc3339DateTimeWithOffset(value)).toBeUndefined();
  });

  describe("parses properly formatted dates", () => {
    it("with fractional seconds", () => {
      expect(_parseRfc3339DateTimeWithOffset("1985-04-12T23:20:50.52Z")).toEqual(
        new Date(Date.UTC(1985, 3, 12, 23, 20, 50, 520))
      );
    });
    it("without fractional seconds", () => {
      expect(_parseRfc3339DateTimeWithOffset("1985-04-12T23:20:50Z")).toEqual(
        new Date(Date.UTC(1985, 3, 12, 23, 20, 50, 0))
      );
    });
    it("with leap seconds", () => {
      expect(_parseRfc3339DateTimeWithOffset("1990-12-31T15:59:60Z")).toEqual(
        new Date(Date.UTC(1990, 11, 31, 15, 59, 60, 0))
      );
    });
    it("with leap days", () => {
      expect(_parseRfc3339DateTimeWithOffset("2004-02-29T15:59:59Z")).toEqual(
        new Date(Date.UTC(2004, 1, 29, 15, 59, 59, 0))
      );
    });
    it("with leading zeroes", () => {
      expect(_parseRfc3339DateTimeWithOffset("0104-02-09T05:09:09.09Z")).toEqual(
        new Date(Date.UTC(104, 1, 9, 5, 9, 9, 90))
      );
      expect(_parseRfc3339DateTimeWithOffset("0104-02-09T00:00:00.00Z")).toEqual(
        new Date(Date.UTC(104, 1, 9, 0, 0, 0, 0))
      );
    });
    it("with negative offset", () => {
      expect(_parseRfc3339DateTimeWithOffset("2019-12-16T22:48:18-01:02")).toEqual(
        new Date(Date.UTC(2019, 11, 16, 23, 50, 18, 0))
      );
    });
    it("with positive offset", () => {
      expect(_parseRfc3339DateTimeWithOffset("2019-12-16T22:48:18+02:04")).toEqual(
        new Date(Date.UTC(2019, 11, 16, 20, 44, 18, 0))
      );
    });
  });

  it.each(invalidRfc3339DateTimes)("rejects %s", (value) => {
    expect(() => _parseRfc3339DateTimeWithOffset(value)).toThrowError();
  });
});

describe("_parseRfc7231DateTime", () => {
  it.each([null, undefined])("returns undefined for %s", (value) => {
    expect(_parseRfc7231DateTime(value)).toBeUndefined();
  });

  describe("parses properly formatted dates", () => {
    describe("with fractional seconds", () => {
      it.each([
        ["imf-fixdate", "Sun, 06 Nov 1994 08:49:37.52 GMT"],
        ["rfc-850", "Sunday, 06-Nov-94 08:49:37.52 GMT"],
        ["asctime", "Sun Nov  6 08:49:37.52 1994"],
      ])("in format %s", (_, value) => {
        expect(_parseRfc7231DateTime(value)).toEqual(new Date(Date.UTC(1994, 10, 6, 8, 49, 37, 520)));
      });
    });
    describe("with fractional seconds - single digit hour", () => {
      it.each([
        ["imf-fixdate", "Sun, 06 Nov 1994 8:49:37.52 GMT"],
        ["rfc-850", "Sunday, 06-Nov-94 8:49:37.52 GMT"],
        ["asctime", "Sun Nov  6 8:49:37.52 1994"],
      ])("in format %s", (_, value) => {
        expect(_parseRfc7231DateTime(value)).toEqual(new Date(Date.UTC(1994, 10, 6, 8, 49, 37, 520)));
      });
    });
    describe("without fractional seconds", () => {
      it.each([
        ["imf-fixdate", "Sun, 06 Nov 1994 08:49:37 GMT"],
        ["rfc-850", "Sunday, 06-Nov-94 08:49:37 GMT"],
        ["asctime", "Sun Nov  6 08:49:37 1994"],
      ])("in format %s", (_, value) => {
        expect(_parseRfc7231DateTime(value)).toEqual(new Date(Date.UTC(1994, 10, 6, 8, 49, 37, 0)));
      });
    });
    describe("without fractional seconds - single digit hour", () => {
      it.each([
        ["imf-fixdate", "Sun, 06 Nov 1994 8:49:37 GMT"],
        ["rfc-850", "Sunday, 06-Nov-94 8:49:37 GMT"],
        ["asctime", "Sun Nov  6 8:49:37 1994"],
      ])("in format %s", (_, value) => {
        expect(_parseRfc7231DateTime(value)).toEqual(new Date(Date.UTC(1994, 10, 6, 8, 49, 37, 0)));
      });
    });
    describe("with leap seconds", () => {
      it.each([
        ["imf-fixdate", "Mon, 31 Dec 1990 15:59:60 GMT"],
        ["rfc-850", "Monday, 31-Dec-90 15:59:60 GMT"],
        ["asctime", "Mon Dec 31 15:59:60 1990"],
      ])("in format %s", (_, value) => {
        expect(_parseRfc7231DateTime(value)).toEqual(new Date(Date.UTC(1990, 11, 31, 15, 59, 60, 0)));
      });
    });
    describe("with leap seconds - single digit hour", () => {
      it.each([
        ["imf-fixdate", "Mon, 31 Dec 1990 8:59:60 GMT"],
        ["rfc-850", "Monday, 31-Dec-90 8:59:60 GMT"],
        ["asctime", "Mon Dec 31 8:59:60 1990"],
      ])("in format %s", (_, value) => {
        expect(_parseRfc7231DateTime(value)).toEqual(new Date(Date.UTC(1990, 11, 31, 8, 59, 60, 0)));
      });
    });
    describe("with leap days", () => {
      it.each([
        ["imf-fixdate", "Sun, 29 Feb 2004 15:59:59 GMT"],
        ["asctime", "Sun Feb 29 15:59:59 2004"],
      ])("in format %s", (_, value) => {
        expect(_parseRfc7231DateTime(value)).toEqual(new Date(Date.UTC(2004, 1, 29, 15, 59, 59, 0)));
      });
    });
    describe("with leap days - single digit hour", () => {
      it.each([
        ["imf-fixdate", "Sun, 29 Feb 2004 8:59:59 GMT"],
        ["asctime", "Sun Feb 29 8:59:59 2004"],
      ])("in format %s", (_, value) => {
        expect(_parseRfc7231DateTime(value)).toEqual(new Date(Date.UTC(2004, 1, 29, 8, 59, 59, 0)));
      });
    });
    describe("with leading zeroes", () => {
      it.each([
        ["imf-fixdate", "Sun, 06 Nov 0104 08:09:07.02 GMT", 104],
        ["rfc-850", "Sunday, 06-Nov-04 08:09:07.02 GMT", 1904],
        ["asctime", "Sun Nov  6 08:09:07.02 0104", 104],
      ])("in format %s", (_, value, year) => {
        expect(_parseRfc7231DateTime(value)).toEqual(new Date(Date.UTC(year, 10, 6, 8, 9, 7, 20)));
      });
    });
    describe("with all-zero components", () => {
      it.each([
        ["imf-fixdate", "Sun, 06 Nov 0104 00:00:00.00 GMT", 104],
        ["rfc-850", "Sunday, 06-Nov-94 00:00:00.00 GMT", 1994],
        ["asctime", "Sun Nov  6 00:00:00.00 0104", 104],
      ])("in format %s", (_, value, year) => {
        expect(_parseRfc7231DateTime(value)).toEqual(new Date(Date.UTC(year, 10, 6, 0, 0, 0, 0)));
      });
    });
  });

  // note: some edge cases are not handled because the amount of code needed to enforce
  // them client-side is excessive. We trust our services' response values.
  it.each([
    "1985-04-12T23:20:50.52Z", // RFC 3339 format, not RFC 7231
    "1985-04-12T23:20:50Z", // RFC 3339 format, not RFC 7231

    "Sun, 06 Nov 0004 08:09:07.02 GMTSun, 06 Nov 0004 08:09:07.02 GMT", // Contains multiple timestamps
    "Sun, 06 Nov 0004 08:09:07.02 GMTA", // Contains invalid characters after GMT
    "ASun, 06 Nov 0004 08:09:07.02 GMT", // Contains invalid characters before timestamp
    "Sun, 06 Nov 94 08:49:37 GMT", // Year must be 4 digits
    "Sun, 06 Dov 1994 08:49:37 GMT", // Invalid month name
    "Mun, 06 Nov 1994 08:49:37 GMT", // Invalid day name
    // "Sunday, 06 Nov 1994 08:49:37 GMT", // Wrong format - uses full day name in IMF-fixdate format
    "Sun, 06 November 1994 08:49:37 GMT", // Wrong format - uses full month name
    "Sun, 06 Nov 1994 24:49:37 GMT", // Hours cannot be 24
    "Sun, 06 Nov 1994 08:69:37 GMT", // Minutes cannot be > 59
    "Sun, 06 Nov 1994 08:49:67 GMT", // Seconds cannot be > 60 (60 only allowed for leap second)
    "Sun, 06-11-1994 08:49:37 GMT", // Wrong date format - uses dashes instead of spaces
    "Sun, 06 11 1994 08:49:37 GMT", // Wrong format - uses numeric month instead of abbreviated name
    // "Sun, 31 Nov 1994 08:49:37 GMT", // Invalid date - November has 30 days
    // "Sun, 29 Feb 2005 15:59:59 GMT", // Invalid date - 2005 was not a leap year

    "Sunday, 06-Nov-04 08:09:07.02 GMTSunday, 06-Nov-04 08:09:07.02 GMT", // Contains multiple timestamps
    "ASunday, 06-Nov-04 08:09:07.02 GMT", // Contains invalid characters before timestamp
    "Sunday, 06-Nov-04 08:09:07.02 GMTA", // Contains invalid characters after GMT
    "Sunday, 06-Nov-1994 08:49:37 GMT", // Wrong format - uses 4 digit year in RFC 850 format
    "Sunday, 06-Dov-94 08:49:37 GMT", // Invalid month name
    "Sundae, 06-Nov-94 08:49:37 GMT", // Invalid day name
    // "Sun, 06-Nov-94 08:49:37 GMT", // Wrong format - uses abbreviated day name in RFC 850 format
    "Sunday, 06-November-94 08:49:37 GMT", // Wrong format - uses full month name
    "Sunday, 06-Nov-94 24:49:37 GMT", // Hours cannot be 24
    "Sunday, 06-Nov-94 08:69:37 GMT", // Minutes cannot be > 59
    "Sunday, 06-Nov-94 08:49:67 GMT", // Seconds cannot be > 60 (60 only allowed for leap second)
    "Sunday, 06 11 94 08:49:37 GMT", // Wrong format - uses spaces instead of dashes
    "Sunday, 06-11-1994 08:49:37 GMT", // Wrong format - uses numeric month and 4 digit year
    // "Sunday, 31-Nov-94 08:49:37 GMT", // Invalid date - November has 30 days
    // "Sunday, 29-Feb-05 15:59:59 GMT", // Invalid date - 2005 was not a leap year

    "Sun Nov  6 08:09:07.02 0004Sun Nov  6 08:09:07.02 0004", // Contains multiple timestamps
    "ASun Nov  6 08:09:07.02 0004", // Contains invalid characters before timestamp
    "Sun Nov  6 08:09:07.02 0004A", // Contains invalid characters after timestamp
    "Sun Nov  6 08:49:37 94", // Year must be 4 digits in asctime format
    "Sun Dov  6 08:49:37 1994", // Invalid month name
    "Mun Nov  6 08:49:37 1994", // Invalid day name
    // "Sunday Nov  6 08:49:37 1994", // Wrong format - uses full day name
    "Sun November  6 08:49:37 1994", // Wrong format - uses full month name
    "Sun Nov  6 24:49:37 1994", // Hours cannot be 24
    "Sun Nov  6 08:69:37 1994", // Minutes cannot be > 59
    "Sun Nov  6 08:49:67 1994", // Seconds cannot be > 60 (60 only allowed for leap second)
    "Sun 06-11 08:49:37 1994", // Wrong format - uses dashes in date
    "Sun 06 11 08:49:37 1994", // Wrong format - uses numeric month
    "Sun 11  6 08:49:37 1994", // Wrong format - month and day in wrong order
    // "Sun Nov 31 08:49:37 1994", // Invalid date - November has 30 days
    // "Sun Feb 29 15:59:59 2005", // Invalid date - 2005 was not a leap year
    "Sun Nov 6 08:49:37 1994", // Wrong format - missing space after single digit day
  ])("rejects %s", (value) => {
    expect(() => _parseRfc7231DateTime(value)).toThrowError();
  });
});

describe("_parseEpochTimestamp", () => {
  it.each([null, undefined])("returns undefined for %s", (value) => {
    expect(_parseEpochTimestamp(value)).toBeUndefined();
  });

  describe("parses properly formatted dates", () => {
    describe("with fractional seconds", () => {
      it.each(["482196050.52", 482196050.52])("parses %s", (value) => {
        expect(_parseEpochTimestamp(value)).toEqual(new Date(Date.UTC(1985, 3, 12, 23, 20, 50, 520)));
      });
    });
    describe("without fractional seconds", () => {
      it.each(["482196050", 482196050, 482196050.0])("parses %s", (value) => {
        expect(_parseEpochTimestamp(value)).toEqual(new Date(Date.UTC(1985, 3, 12, 23, 20, 50, 0)));
      });
    });
  });
  it.each([
    "1985-04-12T23:20:50.52Z",
    "1985-04-12T23:20:50Z",
    "Mon, 31 Dec 1990 15:59:60 GMT",
    "Monday, 31-Dec-90 15:59:60 GMT",
    "Mon Dec 31 15:59:60 1990",
    "NaN",
    NaN,
    "Infinity",
    Infinity,
    "0x42",
  ])("rejects %s", (value) => {
    expect(() => _parseEpochTimestamp(value)).toThrowError();
  });
});
