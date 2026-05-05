import { HttpResponse } from "@smithy/core/protocols";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseRetryAfterHeader } from "./parseRetryAfterHeader";

describe(parseRetryAfterHeader.name, () => {
  const NOW = 1_773_769_074_339;

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns undefined for non-HttpResponse input", () => {
    expect(parseRetryAfterHeader("not a response")).toBeUndefined();
    expect(parseRetryAfterHeader(null)).toBeUndefined();
    expect(parseRetryAfterHeader(undefined)).toBeUndefined();
  });

  it("returns undefined when no retry headers are present", () => {
    const response = new HttpResponse({ statusCode: 503, headers: { "content-type": "application/json" } });
    expect(parseRetryAfterHeader(response)).toBeUndefined();
  });

  describe("retry-after header", () => {
    it("parses plain numeric seconds", () => {
      const response = new HttpResponse({ statusCode: 503, headers: { "retry-after": "120" } });
      const result = parseRetryAfterHeader(response);
      expect(result).toEqual(new Date(NOW + 120_000));
    });

    it("parses RFC 7231 date string ending in GMT", () => {
      const futureDate = new Date(NOW + 60_000);
      const rfc7231 = futureDate.toUTCString(); // "Tue, 14 Nov 2023 22:14:20 GMT"
      const response = new HttpResponse({ statusCode: 503, headers: { "retry-after": rfc7231 } });
      const result = parseRetryAfterHeader(response);
      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBeGreaterThanOrEqual(NOW + 59_000);
      expect(result!.getTime()).toBeLessThanOrEqual(NOW + 61_000);
    });

    it("parses 'GMT, <seconds>' suffix format", () => {
      const futureDate = new Date(NOW + 30_000);
      const rfc7231 = futureDate.toUTCString();
      const headerValue = `${rfc7231}, 45`;
      const response = new HttpResponse({ statusCode: 503, headers: { "retry-after": headerValue } });
      const result = parseRetryAfterHeader(response);
      expect(result).toEqual(new Date(NOW + 45_000));
    });

    it("returns undefined for non-numeric, non-date string", () => {
      const response = new HttpResponse({ statusCode: 503, headers: { "retry-after": "not-a-number" } });
      expect(parseRetryAfterHeader(response)).toBeUndefined();
    });

    it("returns undefined when RFC 7231 parsing fails", () => {
      const response = new HttpResponse({ statusCode: 503, headers: { "retry-after": "Invalid Date GMT" } });
      const logger = { trace: vi.fn() } as any;
      const result = parseRetryAfterHeader(response, logger);
      expect(result).toBeUndefined();
    });

    it("as a last resort (backwards compatibility), ISO format headers are also parsed", () => {
      const futureDate = new Date(NOW + 30_000);
      const isoDate = futureDate.toISOString();
      const response = new HttpResponse({ statusCode: 503, headers: { "retry-after": isoDate } });
      const result = parseRetryAfterHeader(response);

      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBeGreaterThanOrEqual(NOW + 29_000);
      expect(result!.getTime()).toBeLessThanOrEqual(NOW + 31_000);
    });
  });

  describe("x-amz-retry-after header", () => {
    it("parses milliseconds value", () => {
      const response = new HttpResponse({ statusCode: 503, headers: { "x-amz-retry-after": "5000" } });
      const result = parseRetryAfterHeader(response);
      expect(result).toEqual(new Date(NOW + 5000));
    });

    it("returns undefined for non-numeric value", () => {
      const logger = { trace: vi.fn() } as any;
      const response = new HttpResponse({ statusCode: 503, headers: { "x-amz-retry-after": "abc" } });
      expect(parseRetryAfterHeader(response, logger)).toBeUndefined();
      expect(logger.trace).toHaveBeenCalled();
    });
  });

  it("prefers retry-after over x-amz-retry-after when retry-after comes first", () => {
    const response = new HttpResponse({
      statusCode: 503,
      headers: { "retry-after": "10", "x-amz-retry-after": "9999" },
    });
    const result = parseRetryAfterHeader(response);
    expect(result).toEqual(new Date(NOW + 10_000));
  });
});
