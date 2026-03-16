import { HttpRequest, HttpResponse } from "@smithy/protocol-http";
import { isThrottlingError } from "@smithy/service-error-classification";
import {
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_RETRY_DELAY_BASE,
  INITIAL_RETRY_TOKENS,
  RETRY_MODES,
  THROTTLING_RETRY_DELAY_BASE,
} from "@smithy/util-retry";
import { v4 } from "@smithy/uuid";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

import { getDefaultRetryQuota } from "./defaultRetryQuota";
import { defaultDelayDecider } from "./delayDecider";
import { defaultRetryDecider } from "./retryDecider";
import { StandardRetryStrategy } from "./StandardRetryStrategy";
import type { RetryQuota } from "./types";

vi.mock("@smithy/service-error-classification");
vi.mock("./delayDecider");
vi.mock("./retryDecider");
vi.mock("./defaultRetryQuota");
vi.mock("@smithy/protocol-http");
vi.mock("@smithy/uuid");

describe("defaultStrategy", () => {
  let next: any; // variable for next mock function in utility methods
  const maxAttempts = 3;

  const mockDefaultRetryQuota = {
    hasRetryTokens: vi.fn().mockReturnValue(true),
    retrieveRetryTokens: vi.fn().mockReturnValue(1),
    releaseRetryTokens: vi.fn(),
  };

  const mockSuccessfulOperation = (maxAttempts: number, options?: { mockResponse?: string }) => {
    next = vi.fn().mockResolvedValueOnce({
      response: options?.mockResponse,
      output: { $metadata: {} },
    });

    const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts));
    return retryStrategy.retry(next, { request: { headers: {} } } as any);
  };

  const mockFailedOperation = async (maxAttempts: number, options?: { mockError?: Error }) => {
    const mockError = options?.mockError ?? new Error("mockError");
    next = vi.fn().mockRejectedValue(mockError);

    const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts));
    try {
      await retryStrategy.retry(next, { request: { headers: {} } } as any);
    } catch (error) {
      expect(error).toStrictEqual(mockError);
      return error;
    }
  };

  const mockSuccessAfterOneFail = (maxAttempts: number, options?: { mockError?: Error; mockResponse?: string }) => {
    const mockError = options?.mockError ?? new Error("mockError");
    const mockResponse = {
      response: options?.mockResponse,
      output: { $metadata: {} },
    };

    next = vi.fn().mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockResponse);

    const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts));
    return retryStrategy.retry(next, { request: { headers: {} } } as any);
  };

  const mockSuccessAfterTwoFails = (maxAttempts: number, options?: { mockError?: Error; mockResponse?: string }) => {
    const mockError = options?.mockError ?? new Error("mockError");
    const mockResponse = {
      response: options?.mockResponse,
      output: { $metadata: {} },
    };

    next = vi
      .fn()
      .mockRejectedValueOnce(mockError)
      .mockRejectedValueOnce(mockError)
      .mockResolvedValueOnce(mockResponse);

    const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts));
    return retryStrategy.retry(next, { request: { headers: {} } } as any);
  };

  beforeEach(() => {
    vi.mocked(isThrottlingError).mockReturnValue(true);
    vi.mocked(defaultDelayDecider).mockReturnValue(0);
    vi.mocked(defaultRetryDecider).mockReturnValue(true);
    vi.mocked(getDefaultRetryQuota).mockReturnValue(mockDefaultRetryQuota);
    (HttpRequest as unknown as any).mockReturnValue({
      isInstance: vi.fn().mockReturnValue(false),
    });
    (HttpResponse as unknown as any).mockReturnValue({
      isInstance: vi.fn().mockReturnValue(false),
    });
    vi.mocked(v4).mockReturnValue("42");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sets maxAttemptsProvider as class member variable", async () => {
    await Promise.all(
      [1, 2, 3].map(async (maxAttempts) => {
        const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts));
        expect(await retryStrategy["maxAttemptsProvider"]()).toBe(maxAttempts);
      })
    );
  });

  it(`sets mode=${RETRY_MODES.STANDARD}`, () => {
    const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts));
    expect(retryStrategy.mode).toStrictEqual(RETRY_MODES.STANDARD);
  });

  it("handles non-standard errors", async () => {
    const nonStandardErrors = [undefined, "foo", { foo: "bar" }, 123, false, null];
    const maxAttempts = 1;
    const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts));
    for (const error of nonStandardErrors) {
      next = vi.fn().mockRejectedValue(error);
      expect(await retryStrategy.retry(next, { request: { headers: {} } } as any).catch((_) => _)).toBeInstanceOf(
        Error
      );
    }
  });

  describe("retryDecider init", () => {
    it("sets defaultRetryDecider if options is undefined", () => {
      const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts));
      expect(retryStrategy["retryDecider"]).toBe(defaultRetryDecider);
    });

    it("sets defaultRetryDecider if options.retryDecider is undefined", () => {
      const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts), {});
      expect(retryStrategy["retryDecider"]).toBe(defaultRetryDecider);
    });

    it("sets options.retryDecider if defined", () => {
      const retryDecider = vi.fn();
      const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts), {
        retryDecider,
      });
      expect(retryStrategy["retryDecider"]).toBe(retryDecider);
    });
  });

  describe("delayDecider init", () => {
    it("sets defaultDelayDecider if options is undefined", () => {
      const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts));
      expect(retryStrategy["delayDecider"]).toBe(defaultDelayDecider);
    });

    it("sets defaultDelayDecider if options.delayDecider undefined", () => {
      const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts), {});
      expect(retryStrategy["delayDecider"]).toBe(defaultDelayDecider);
    });

    it("sets options.delayDecider if defined", () => {
      const delayDecider = vi.fn();
      const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts), {
        delayDecider,
      });
      expect(retryStrategy["delayDecider"]).toBe(delayDecider);
    });
  });

  describe("retryQuota init", () => {
    it("sets getDefaultRetryQuota if options is undefined", () => {
      const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts));
      expect(retryStrategy["retryQuota"]).toBe(getDefaultRetryQuota(INITIAL_RETRY_TOKENS));
    });

    it("sets getDefaultRetryQuota if options.delayDecider undefined", () => {
      const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts), {});
      expect(retryStrategy["retryQuota"]).toBe(getDefaultRetryQuota(INITIAL_RETRY_TOKENS));
    });

    it("sets options.retryQuota if defined", () => {
      const retryQuota = {} as RetryQuota;
      const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts), {
        retryQuota,
      });
      expect(retryStrategy["retryQuota"]).toBe(retryQuota);
    });
  });

  describe("delayDecider", () => {
    describe("delayBase value passed", () => {
      const testDelayBasePassed = async (delayBaseToTest: number, mockThrottlingError: boolean) => {
        vi.mocked(isThrottlingError).mockReturnValueOnce(mockThrottlingError);

        const mockError = new Error();
        await mockSuccessAfterOneFail(maxAttempts, { mockError });

        expect(vi.mocked(isThrottlingError)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(isThrottlingError)).toHaveBeenCalledWith(mockError);
        expect(vi.mocked(defaultDelayDecider)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(defaultDelayDecider).mock.calls[0][0]).toBe(delayBaseToTest);
      };

      it("should be equal to THROTTLING_RETRY_DELAY_BASE if error is throttling error", async () => {
        return testDelayBasePassed(THROTTLING_RETRY_DELAY_BASE, true);
      });

      it("should be equal to DEFAULT_RETRY_DELAY_BASE in error is not a throttling error", async () => {
        return testDelayBasePassed(DEFAULT_RETRY_DELAY_BASE, false);
      });
    });

    describe("attempts value passed", () => {
      it("on successful operation", async () => {
        await mockSuccessfulOperation(maxAttempts);
        expect(vi.mocked(defaultDelayDecider)).not.toHaveBeenCalled();
      });

      it("in case of single failure", async () => {
        await mockSuccessAfterOneFail(maxAttempts);
        expect(vi.mocked(defaultDelayDecider)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(defaultDelayDecider).mock.calls[0][1]).toBe(1);
      });

      it("on all fails", async () => {
        await mockFailedOperation(maxAttempts);
        expect(vi.mocked(defaultDelayDecider)).toHaveBeenCalledTimes(2);
        expect(vi.mocked(defaultDelayDecider).mock.calls[0][1]).toBe(1);
        expect(vi.mocked(defaultDelayDecider).mock.calls[1][1]).toBe(2);
      });
    });

    describe("totalRetryDelay", () => {
      describe("when retry-after is not set", () => {
        it("should be equal to sum of values computed by delayDecider", async () => {
          vi.spyOn(global, "setTimeout");

          const FIRST_DELAY = 100;
          const SECOND_DELAY = 200;

          vi.mocked(defaultDelayDecider).mockReturnValueOnce(FIRST_DELAY).mockReturnValueOnce(SECOND_DELAY);

          const maxAttempts = 3;
          const error = await mockFailedOperation(maxAttempts);
          expect(error.$metadata.totalRetryDelay).toEqual(FIRST_DELAY + SECOND_DELAY);

          expect(vi.mocked(defaultDelayDecider)).toHaveBeenCalledTimes(maxAttempts - 1);
          expect(setTimeout).toHaveBeenCalledTimes(maxAttempts - 1);
          expect((setTimeout as unknown as any).mock.calls[0][1]).toBe(FIRST_DELAY);
          expect((setTimeout as unknown as any).mock.calls[1][1]).toBe(SECOND_DELAY);
        });
      });

      describe("when retry-after is set", () => {
        const getErrorWithValues = async (
          delayDeciderInMs: number,
          retryAfter: number | string,
          retryAfterHeaderName?: string
        ) => {
          vi.mocked(defaultDelayDecider).mockReturnValueOnce(delayDeciderInMs);

          const maxAttempts = 2;
          const mockError = new Error();
          Object.defineProperty(mockError, "$response", {
            value: {
              headers: { [retryAfterHeaderName ? retryAfterHeaderName : "retry-after"]: String(retryAfter) },
            },
          });
          const error = await mockFailedOperation(maxAttempts, { mockError });
          expect(vi.mocked(defaultDelayDecider)).toHaveBeenCalledTimes(maxAttempts - 1);
          expect(setTimeout).toHaveBeenCalledTimes(maxAttempts - 1);

          return error;
        };

        beforeEach(() => {
          vi.spyOn(global, "setTimeout");
        });

        describe("uses retry-after value if it's greater than that from delayDecider", () => {
          beforeEach(() => {
            const { isInstance } = HttpResponse;
            (isInstance as unknown as any).mockReturnValueOnce(true);
          });

          describe("when value is in seconds", () => {
            const testWithHeaderName = async (retryAfterHeaderName: string) => {
              const delayDeciderInMs = 2000;
              const retryAfterInSeconds = 3;

              const error = await getErrorWithValues(delayDeciderInMs, retryAfterInSeconds, retryAfterHeaderName);
              expect(error.$metadata.totalRetryDelay).toEqual(retryAfterInSeconds * 1000);
              expect((setTimeout as unknown as any).mock.calls[0][1]).toBe(retryAfterInSeconds * 1000);
            };

            it("with header in small case", async () => {
              testWithHeaderName("retry-after");
            });

            it("with header with first letter capital", async () => {
              testWithHeaderName("Retry-After");
            });
          });

          it("when value is a Date", async () => {
            const mockDateNow = Date.now();
            vi.spyOn(Date, "now").mockReturnValue(mockDateNow);

            const delayDeciderInMs = 2000;
            const retryAfterInSeconds = 3;
            const retryAfterDate = new Date(mockDateNow + retryAfterInSeconds * 1000);

            const error = await getErrorWithValues(delayDeciderInMs, retryAfterDate.toISOString());
            expect(error.$metadata.totalRetryDelay).toEqual(retryAfterInSeconds * 1000);
            expect((setTimeout as unknown as any).mock.calls[0][1]).toBe(retryAfterInSeconds * 1000);
          });
        });

        it("ignores retry-after value if it's smaller than that from delayDecider", async () => {
          const delayDeciderInMs = 3000;
          const retryAfterInSeconds = 2;

          const error = await getErrorWithValues(delayDeciderInMs, retryAfterInSeconds);
          expect(error.$metadata.totalRetryDelay).toEqual(delayDeciderInMs);
          expect((setTimeout as unknown as any).mock.calls[0][1]).toBe(delayDeciderInMs);
        });
      });
    });
  });

  describe("retryQuota", () => {
    describe("hasRetryTokens", () => {
      it("not called on successful operation", async () => {
        const { hasRetryTokens } = getDefaultRetryQuota(INITIAL_RETRY_TOKENS);
        await mockSuccessfulOperation(maxAttempts);
        expect(hasRetryTokens).not.toHaveBeenCalled();
      });

      it("called once in case of single failure", async () => {
        const { hasRetryTokens } = getDefaultRetryQuota(INITIAL_RETRY_TOKENS);
        await mockSuccessAfterOneFail(maxAttempts);
        expect(hasRetryTokens).toHaveBeenCalledTimes(1);
      });

      it("called once on each retry request", async () => {
        const { hasRetryTokens } = getDefaultRetryQuota(INITIAL_RETRY_TOKENS);
        await mockFailedOperation(maxAttempts);
        expect(hasRetryTokens).toHaveBeenCalledTimes(maxAttempts - 1);
      });
    });

    describe("releaseRetryTokens", () => {
      it("called once without param on successful operation", async () => {
        const { releaseRetryTokens } = getDefaultRetryQuota(INITIAL_RETRY_TOKENS);
        await mockSuccessfulOperation(maxAttempts);
        expect(releaseRetryTokens).toHaveBeenCalledTimes(1);
        expect(releaseRetryTokens).toHaveBeenCalledWith(undefined);
      });

      it("called once with retryTokenAmount in case of single failure", async () => {
        const retryTokens = 15;
        const { releaseRetryTokens, retrieveRetryTokens } = getDefaultRetryQuota(INITIAL_RETRY_TOKENS);
        vi.mocked(retrieveRetryTokens).mockReturnValueOnce(retryTokens);

        await mockSuccessAfterOneFail(maxAttempts);
        expect(releaseRetryTokens).toHaveBeenCalledTimes(1);
        expect(releaseRetryTokens).toHaveBeenCalledWith(retryTokens);
      });

      it("called once with second retryTokenAmount in case of two failures", async () => {
        const retryTokensFirst = 15;
        const retryTokensSecond = 30;

        const { releaseRetryTokens, retrieveRetryTokens } = getDefaultRetryQuota(INITIAL_RETRY_TOKENS);

        vi.mocked(retrieveRetryTokens).mockReturnValueOnce(retryTokensFirst).mockReturnValueOnce(retryTokensSecond);

        await mockSuccessAfterTwoFails(maxAttempts);
        expect(releaseRetryTokens).toHaveBeenCalledTimes(1);
        expect(releaseRetryTokens).toHaveBeenCalledWith(retryTokensSecond);
      });

      it("not called on unsuccessful operation", async () => {
        const { releaseRetryTokens } = getDefaultRetryQuota(INITIAL_RETRY_TOKENS);
        await mockFailedOperation(maxAttempts);
        expect(releaseRetryTokens).not.toHaveBeenCalled();
      });
    });

    describe("retrieveRetryTokens", () => {
      it("not called on successful operation", async () => {
        const { retrieveRetryTokens } = getDefaultRetryQuota(INITIAL_RETRY_TOKENS);
        await mockSuccessfulOperation(maxAttempts);
        expect(retrieveRetryTokens).not.toHaveBeenCalled();
      });

      it("called once in case of single failure", async () => {
        const { retrieveRetryTokens } = getDefaultRetryQuota(INITIAL_RETRY_TOKENS);
        await mockSuccessAfterOneFail(maxAttempts);
        expect(retrieveRetryTokens).toHaveBeenCalledTimes(1);
      });

      it("called once on each retry request", async () => {
        const { retrieveRetryTokens } = getDefaultRetryQuota(INITIAL_RETRY_TOKENS);
        await mockFailedOperation(maxAttempts);
        expect(retrieveRetryTokens).toHaveBeenCalledTimes(maxAttempts - 1);
      });
    });
  });

  describe("should not retry", () => {
    it("when the handler completes successfully", async () => {
      const mockResponse = "mockResponse";
      const { response, output } = await mockSuccessfulOperation(maxAttempts, {
        mockResponse,
      });

      expect(response).toStrictEqual(mockResponse);
      expect(output.$metadata.attempts).toBe(1);
      expect(output.$metadata.totalRetryDelay).toBe(0);
      expect(vi.mocked(defaultRetryDecider)).not.toHaveBeenCalled();
      expect(vi.mocked(defaultDelayDecider)).not.toHaveBeenCalled();
    });

    it("when retryDecider returns false", async () => {
      vi.mocked(defaultRetryDecider).mockReturnValueOnce(false);
      const mockError = new Error();
      await mockFailedOperation(maxAttempts, { mockError });
      expect(vi.mocked(defaultRetryDecider)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(defaultRetryDecider)).toHaveBeenCalledWith(mockError);
    });

    it("when the maximum number of attempts is reached", async () => {
      await mockFailedOperation(maxAttempts);
      expect(vi.mocked(defaultRetryDecider)).toHaveBeenCalledTimes(maxAttempts - 1);
    });

    describe("when retryQuota.hasRetryTokens returns false", () => {
      it("in the first request", async () => {
        const { hasRetryTokens, retrieveRetryTokens, releaseRetryTokens } = getDefaultRetryQuota(INITIAL_RETRY_TOKENS);
        vi.mocked(hasRetryTokens).mockReturnValueOnce(false);

        const mockError = new Error();
        await mockFailedOperation(maxAttempts, { mockError });

        expect(hasRetryTokens).toHaveBeenCalledTimes(1);
        expect(hasRetryTokens).toHaveBeenCalledWith(mockError);
        expect(retrieveRetryTokens).not.toHaveBeenCalled();
        expect(releaseRetryTokens).not.toHaveBeenCalled();
      });

      it("after the first retry", async () => {
        const { hasRetryTokens, retrieveRetryTokens, releaseRetryTokens } = getDefaultRetryQuota(INITIAL_RETRY_TOKENS);
        vi.mocked(hasRetryTokens).mockReturnValueOnce(true).mockReturnValueOnce(false);

        const mockError = new Error();
        await mockFailedOperation(maxAttempts, { mockError });

        expect(hasRetryTokens).toHaveBeenCalledTimes(2);
        [1, 2].forEach((n) => {
          expect(hasRetryTokens).toHaveBeenNthCalledWith(n, mockError);
        });
        expect(retrieveRetryTokens).toHaveBeenCalledTimes(1);
        expect(retrieveRetryTokens).toHaveBeenCalledWith(mockError);
        expect(releaseRetryTokens).not.toHaveBeenCalled();
      });
    });
  });

  describe("retry informational header: amz-sdk-invocation-id", () => {
    describe("not added if HttpRequest.isInstance returns false", () => {
      it("on successful operation", async () => {
        await mockSuccessfulOperation(maxAttempts);
        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0].request.headers["amz-sdk-invocation-id"]).not.toBeDefined();
      });

      it("in case of single failure", async () => {
        await mockSuccessAfterOneFail(maxAttempts);
        expect(next).toHaveBeenCalledTimes(2);
        [0, 1].forEach((index) => {
          expect(next.mock.calls[index][0].request.headers["amz-sdk-invocation-id"]).not.toBeDefined();
        });
      });

      it("in case of all failures", async () => {
        await mockFailedOperation(maxAttempts);
        expect(next).toHaveBeenCalledTimes(maxAttempts);
        [...Array(maxAttempts).keys()].forEach((index) => {
          expect(next.mock.calls[index][0].request.headers["amz-sdk-invocation-id"]).not.toBeDefined();
        });
      });
    });

    it("uses a unique header for every SDK operation invocation", async () => {
      const { isInstance } = HttpRequest;
      (isInstance as unknown as any).mockReturnValue(true);

      const uuidForInvocationOne = "uuid-invocation-1";
      const uuidForInvocationTwo = "uuid-invocation-2";
      vi.mocked(v4).mockReturnValueOnce(uuidForInvocationOne).mockReturnValueOnce(uuidForInvocationTwo);

      const next = vi.fn().mockResolvedValue({
        response: "mockResponse",
        output: { $metadata: {} },
      });

      const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts));
      await retryStrategy.retry(next, { request: { headers: {} } } as any);
      await retryStrategy.retry(next, { request: { headers: {} } } as any);

      expect(next).toHaveBeenCalledTimes(2);
      expect(next.mock.calls[0][0].request.headers["amz-sdk-invocation-id"]).toBe(uuidForInvocationOne);
      expect(next.mock.calls[1][0].request.headers["amz-sdk-invocation-id"]).toBe(uuidForInvocationTwo);

      (isInstance as unknown as any).mockReturnValue(false);
    });

    it("uses same value for additional HTTP requests associated with an SDK operation", async () => {
      const { isInstance } = HttpRequest;
      (isInstance as unknown as any).mockReturnValueOnce(true);

      const uuidForInvocation = "uuid-invocation-1";
      vi.mocked(v4).mockReturnValueOnce(uuidForInvocation);

      await mockSuccessAfterOneFail(maxAttempts);

      expect(next).toHaveBeenCalledTimes(2);
      expect(next.mock.calls[0][0].request.headers["amz-sdk-invocation-id"]).toBe(uuidForInvocation);
      expect(next.mock.calls[1][0].request.headers["amz-sdk-invocation-id"]).toBe(uuidForInvocation);

      (isInstance as unknown as any).mockReturnValue(false);
    });
  });

  describe("retry informational header: amz-sdk-request", () => {
    describe("not added if HttpRequest.isInstance returns false", () => {
      it("on successful operation", async () => {
        await mockSuccessfulOperation(maxAttempts);
        expect(next).toHaveBeenCalledTimes(1);
        expect(next.mock.calls[0][0].request.headers["amz-sdk-request"]).not.toBeDefined();
      });

      it("in case of single failure", async () => {
        await mockSuccessAfterOneFail(maxAttempts);
        expect(next).toHaveBeenCalledTimes(2);
        [0, 1].forEach((index) => {
          expect(next.mock.calls[index][0].request.headers["amz-sdk-request"]).not.toBeDefined();
        });
      });

      it("in case of all failures", async () => {
        await mockFailedOperation(maxAttempts);
        expect(next).toHaveBeenCalledTimes(maxAttempts);
        [...Array(maxAttempts).keys()].forEach((index) => {
          expect(next.mock.calls[index][0].request.headers["amz-sdk-request"]).not.toBeDefined();
        });
      });
    });

    it("adds header for each attempt", async () => {
      const { isInstance } = HttpRequest;
      (isInstance as unknown as any).mockReturnValue(true);

      const mockError = new Error("mockError");
      next = vi.fn((args) => {
        // the header needs to be verified inside vi.Mock as arguments in
        // vi.mocks.calls has the value passed in final call
        const index = next.mock.calls.length - 1;
        expect(args.request.headers["amz-sdk-request"]).toBe(`attempt=${index + 1}; max=${maxAttempts}`);
        throw mockError;
      });

      const retryStrategy = new StandardRetryStrategy(() => Promise.resolve(maxAttempts));
      try {
        await retryStrategy.retry(next, { request: { headers: {} } } as any);
      } catch (error) {
        expect(error).toStrictEqual(mockError);
        return error;
      }

      expect(next).toHaveBeenCalledTimes(maxAttempts);
      (isInstance as unknown as any).mockReturnValue(false);
    });
  });

  describe("defaults maxAttempts to DEFAULT_MAX_ATTEMPTS", () => {
    it("when maxAttemptsProvider throws error", async () => {
      const { isInstance } = HttpRequest;
      (isInstance as unknown as any).mockReturnValue(true);

      next = vi.fn((args) => {
        expect(args.request.headers["amz-sdk-request"]).toBe(`attempt=1; max=${DEFAULT_MAX_ATTEMPTS}`);
        return Promise.resolve({
          response: "mockResponse",
          output: { $metadata: {} },
        });
      });

      const retryStrategy = new StandardRetryStrategy(() => Promise.reject("ERROR"));
      await retryStrategy.retry(next, { request: { headers: {} } } as any);

      expect(next).toHaveBeenCalledTimes(1);
      (isInstance as unknown as any).mockReturnValue(false);
    });
  });
});
