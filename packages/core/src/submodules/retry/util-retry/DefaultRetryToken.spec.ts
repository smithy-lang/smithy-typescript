import { describe, expect, test as it, vi } from "vitest";

import { DefaultRetryToken } from "./DefaultRetryToken";
import { MAXIMUM_RETRY_DELAY } from "./constants";
import { Retry } from "./retries-2026-config";

vi.mock("./defaultRetryBackoffStrategy");

describe("defaultRetryToken", () => {
  describe("getRetryCost", () => {
    it("is undefined before an error is encountered", () => {
      const retryToken = new DefaultRetryToken(Retry.delay(), 0, undefined, false);
      expect(retryToken.getRetryCost()).toBeUndefined();
    });

    it("returns set value", () => {
      const retryToken = new DefaultRetryToken(Retry.delay(), 0, 25, false);
      expect(retryToken.getRetryCost()).toBe(25);
    });
  });

  describe("getRetryCount", () => {
    it("returns amount set when token is created", () => {
      const retryCount = 3;
      const retryToken = new DefaultRetryToken(Retry.delay(), retryCount, 0, false);
      expect(retryToken.getRetryCount()).toBe(retryCount);
    });
  });

  describe("getRetryDelay", () => {
    it("returns initial delay", () => {
      const retryToken = new DefaultRetryToken(Retry.delay(), 0, 0, false);
      expect(retryToken.getRetryDelay()).toBe(Retry.delay());
    });

    describe(`caps retry delay at ${MAXIMUM_RETRY_DELAY / 1000} seconds`, () => {
      it("when value exceeded because of high delayBase", () => {
        const retryToken = new DefaultRetryToken(Retry.delay() * 1000, 0, 0, false);
        expect(retryToken.getRetryDelay()).toBe(MAXIMUM_RETRY_DELAY);
      });
    });
  });
});
