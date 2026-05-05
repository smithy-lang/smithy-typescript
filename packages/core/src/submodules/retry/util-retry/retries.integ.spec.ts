import { Readable } from "node:stream";
import { cbor } from "@smithy/core/cbor";
import { HttpResponse } from "@smithy/protocol-http";
import type { RetryErrorType, StandardRetryToken } from "@smithy/types";
import { requireRequestsFrom } from "@smithy/util-test/src";
import { afterAll, beforeAll, describe, expect, test as it } from "vitest";
import { XYZService } from "xyz";

import { DefaultRetryBackoffStrategy } from "./DefaultRetryBackoffStrategy";
import { StandardRetryStrategy } from "./StandardRetryStrategy";
import { MAXIMUM_RETRY_DELAY } from "./constants";
import { Retry } from "./retries-2026-config";

class DeterministicRetryBackoffStrategy extends DefaultRetryBackoffStrategy {
  public computeNextBackoffDelay(i: number): number {
    const b = 1; // maximum instead of Math.random()
    const r = 2;
    const t_i = b * Math.min(this.x * r ** i, MAXIMUM_RETRY_DELAY);
    return Math.floor(t_i);
  }
}

describe("retries", () => {
  function createCborResponse(body: any, status = 200) {
    const bytes = cbor.serialize(body);
    return new HttpResponse({
      headers: {
        "smithy-protocol": "rpc-v2-cbor",
      },
      body: Readable.from(bytes),
      statusCode: status,
    });
  }

  it("should retry throttling and transient-error status codes", async () => {
    const client = new XYZService({
      endpoint: "https://localhost/nowhere",
      apiKey: { apiKey: "test-api-key" },
    });

    requireRequestsFrom(client)
      .toMatch({
        hostname: /localhost/,
      })
      .respondWith(
        createCborResponse(
          {
            __type: "HaltError",
          },
          429
        ),
        createCborResponse(
          {
            __type: "HaltError",
          },
          500
        ),
        createCborResponse("", 200)
      );

    const response = await client.getNumbers().catch((e) => e);

    expect(response.$metadata.attempts).toEqual(3);
  });

  it("should retry when a retryable trait is modeled", async () => {
    const client = new XYZService({
      endpoint: "https://localhost/nowhere",
      apiKey: { apiKey: "test-api-key" },
    });

    requireRequestsFrom(client)
      .toMatch({
        hostname: /localhost/,
      })
      .respondWith(
        createCborResponse(
          {
            __type: "RetryableError",
          },
          400 // not retryable status code
        ),
        createCborResponse(
          {
            __type: "RetryableError",
          },
          400 // not retryable status code
        ),
        createCborResponse("", 200)
      );

    const response = await client.getNumbers().catch((e) => e);

    expect(response.$metadata.attempts).toEqual(3);
  });

  it("should retry retryable trait with throttling", async () => {
    const client = new XYZService({
      endpoint: "https://localhost/nowhere",
      apiKey: { apiKey: "test-api-key" },
    });

    requireRequestsFrom(client)
      .toMatch({
        hostname: /localhost/,
      })
      .respondWith(
        createCborResponse(
          {
            __type: "CodedThrottlingError",
          },
          429
        ),
        createCborResponse(
          {
            __type: "MysteryThrottlingError",
          },
          400 // not a retryable status code, but error is modeled as retryable.
        ),
        createCborResponse("", 200)
      );

    const response = await client.getNumbers().catch((e) => e);

    expect(response.$metadata.attempts).toEqual(3);
  });

  it("should not retry if the error is not modeled with retryable trait and is not otherwise retryable", async () => {
    const client = new XYZService({
      endpoint: "https://localhost/nowhere",
      apiKey: { apiKey: "test-api-key" },
    });

    requireRequestsFrom(client)
      .toMatch({
        hostname: /localhost/,
      })
      .respondWith(
        createCborResponse(
          {
            __type: "HaltError",
          },
          429 // not modeled as retryable, but this is a retryable status code.
        ),
        createCborResponse(
          {
            __type: "HaltError",
          },
          400
        ),
        createCborResponse("", 200)
      );

    const response = await client.getNumbers().catch((e) => e);

    // stopped at the second error.
    expect(response.$metadata.attempts).toEqual(2);
  });
});

describe(StandardRetryStrategy.name, () => {
  const inline = (token: StandardRetryToken) => {
    return [token.getRetryCount(), token.getRetryCost(), token.getRetryDelay(), token.isLongPoll?.()];
  };

  describe("retry timings", () => {
    const testCases: Array<{
      name: string;
      timings: [RetryErrorType, number, number | undefined, number, boolean][];
      scope?: string;
      v2026?: boolean;
    }> = [
      {
        name: "3x - transient",
        timings: [
          ["TRANSIENT", 0, undefined, 100, false],
          ["TRANSIENT", 1, 10, 100, false],
          ["TRANSIENT", 2, 10, 200, false],
        ],
      },
      {
        name: "3x - throttling",
        timings: [
          ["THROTTLING", 0, undefined, 100, false],
          ["THROTTLING", 1, 5, 500, false],
          ["THROTTLING", 2, 5, 1000, false],
        ],
      },
      {
        name: "3x - throttling mixed",
        timings: [
          ["THROTTLING", 0, undefined, 100, false],
          ["TRANSIENT", 1, 10, 100, false],
          ["THROTTLING", 2, 5, 1000, false],
        ],
      },
      {
        name: "3x - transient mixed",
        timings: [
          ["TRANSIENT", 0, undefined, 100, false],
          ["THROTTLING", 1, 5, 500, false],
          ["TRANSIENT", 2, 10, 200, false],
        ],
      },
      {
        name: "8x - transient",
        timings: [
          ["TRANSIENT", 0, undefined, 100, false],
          ["TRANSIENT", 1, 10, 100, false],
          ["TRANSIENT", 2, 10, 200, false],
          ["TRANSIENT", 3, 10, 400, false],
          ["TRANSIENT", 4, 10, 800, false],
          ["TRANSIENT", 5, 10, 1600, false],
          ["TRANSIENT", 6, 10, 3200, false],
          ["TRANSIENT", 7, 10, 6400, false],
        ],
      },
      {
        name: "8x - throttling",
        timings: [
          ["THROTTLING", 0, undefined, 100, false],
          ["THROTTLING", 1, 5, 500, false],
          ["THROTTLING", 2, 5, 1000, false],
          ["THROTTLING", 3, 5, 2000, false],
          ["THROTTLING", 4, 5, 4000, false],
          ["THROTTLING", 5, 5, 8000, false],
          ["THROTTLING", 6, 5, 16000, false],
          ["THROTTLING", 7, 5, 20000, false],
        ],
      },
      {
        name: "8x - transient mixed",
        timings: [
          ["TRANSIENT", 0, undefined, 100, false],
          ["THROTTLING", 1, 5, 500, false],
          ["THROTTLING", 2, 5, 1000, false],
          ["TRANSIENT", 3, 10, 400, false],
          ["TRANSIENT", 4, 10, 800, false],
          ["TRANSIENT", 5, 10, 1600, false],
          ["TRANSIENT", 6, 10, 3200, false],
          ["THROTTLING", 7, 5, 20000, false],
        ],
      },
      {
        name: "8x - throttling mixed",
        timings: [
          ["TRANSIENT", 0, undefined, 100, false],
          ["TRANSIENT", 1, 10, 100, false],
          ["THROTTLING", 2, 5, 1000, false],
          ["THROTTLING", 3, 5, 2000, false],
          ["THROTTLING", 4, 5, 4000, false],
          ["THROTTLING", 5, 5, 8000, false],
          ["TRANSIENT", 6, 10, 3200, false],
          ["THROTTLING", 7, 5, 20000, false],
        ],
      },
      {
        name: "12x - throttling mixed longpoll",
        scope: ":longpoll",
        timings: [
          ["TRANSIENT", 0, undefined, 100, false],
          ["TRANSIENT", 1, 10, 100, false],
          ["THROTTLING", 2, 5, 1000, false],
          ["THROTTLING", 3, 5, 2000, false],
          ["THROTTLING", 4, 5, 4000, false],
          ["THROTTLING", 5, 5, 8000, false],
          ["TRANSIENT", 6, 10, 3200, false],
          ["THROTTLING", 7, 5, 20000, false],
          ["THROTTLING", 8, 5, 20000, false],
          ["THROTTLING", 9, 5, 20000, false],
          ["THROTTLING", 10, 5, 20000, false],
          ["THROTTLING", 11, 5, 20000, false],
        ],
      },
    ];

    testCases.push(
      ...(
        [
          {
            name: "8x - transient mixed",
            timings: [
              ["TRANSIENT", 0, undefined, 50, false],
              ["THROTTLING", 1, 5, 1000, false],
              ["THROTTLING", 2, 5, 2000, false],
              ["TRANSIENT", 3, 14, 200, false],
              ["TRANSIENT", 4, 14, 400, false],
              ["TRANSIENT", 5, 14, 800, false],
              ["TRANSIENT", 6, 14, 1600, false],
              ["THROTTLING", 7, 5, 20000, false],
            ],
          },
          {
            name: "8x - throttling mixed",
            timings: [
              ["TRANSIENT", 0, undefined, 50, false],
              ["TRANSIENT", 1, 14, 50, false],
              ["THROTTLING", 2, 5, 2000, false],
              ["THROTTLING", 3, 5, 4000, false],
              ["THROTTLING", 4, 5, 8000, false],
              ["THROTTLING", 5, 5, 16000, false],
              ["TRANSIENT", 6, 14, 1600, false],
              ["THROTTLING", 7, 5, 20000, false],
            ],
          },
          {
            name: "12x - throttling mixed longpoll",
            scope: ":longpoll",
            timings: [
              ["TRANSIENT", 0, undefined, 50, true],
              ["TRANSIENT", 1, 14, 50, true],
              ["THROTTLING", 2, 5, 2000, true],
              ["THROTTLING", 3, 5, 4000, true],
              ["THROTTLING", 4, 5, 8000, true],
              ["THROTTLING", 5, 5, 16000, true],
              ["TRANSIENT", 6, 14, 1600, true],
              ["THROTTLING", 7, 5, 20000, true],
              ["THROTTLING", 8, 5, 20000, true],
              ["THROTTLING", 9, 5, 20000, true],
              ["THROTTLING", 10, 5, 20000, true],
              ["THROTTLING", 11, 5, 20000, true],
            ],
          },
        ] as typeof testCases
      ).map((c) => {
        c.v2026 = true;
        return c;
      })
    );

    for (const { name, timings, scope, v2026 } of testCases) {
      describe(name + (v2026 ? " (2026)" : ""), async () => {
        let retryStrategy!: StandardRetryStrategy;

        beforeAll(() => {
          if (v2026) {
            process.env.SMITHY_NEW_RETRIES_2026 = "true";
            Retry.v2026 = true;
          } else {
            delete process.env.SMITHY_NEW_RETRIES_2026;
            Retry.v2026 = false;
          }
          retryStrategy = new StandardRetryStrategy({
            maxAttempts: timings.length,
            backoff: new DeterministicRetryBackoffStrategy(),
          });
        });

        const tokens: StandardRetryToken[] = [];

        for (let i = 0; i < timings.length; ++i) {
          it(String(i), async () => {
            if (i === 0) {
              const token = await retryStrategy.acquireInitialRetryToken(scope ?? "none");
              tokens.push(token);
            } else {
              const token = await retryStrategy.refreshRetryTokenForRetry(tokens[i - 1], {
                errorType: timings[i][0],
              });
              tokens.push(token);
            }

            expect(inline(tokens[i])).toEqual(timings[i].slice(1));

            if (i === timings.length - 1) {
              const expectedCapacityRemaining = 500 - timings.reduce((acc, [, , cost]) => acc + (cost ?? 0), 0);
              expect(retryStrategy.getCapacity()).toEqual(expectedCapacityRemaining);
            }
          });
        }
      });
    }
  });
});

describe("specification tests", () => {
  type Outcome = "success" | "retry_request" | "max_attempts_exceeded" | "retry_quota_exceeded";

  interface ResponseStep {
    response: { status_code: number; error_code?: string; headers?: Record<string, string> };
    expected: { outcome: Outcome; retry_quota: number; delay?: number };
  }

  interface SpecTestCase {
    name: string;
    given: {
      max_attempts?: number;
      initial_retry_tokens?: number;
      exponential_base?: number;
      max_backoff_time?: number;
      service?: string;
      operation?: string;
    };
    responses: ResponseStep[];
  }

  function errorTypeForResponse(r: ResponseStep["response"]): RetryErrorType {
    if (
      r.status_code === 429 ||
      r.error_code === "Throttling" ||
      r.error_code === "ThrottlingException" ||
      r.error_code === "ProvisionedThroughputExceededException"
    ) {
      return "THROTTLING";
    }
    if ([500, 502, 503, 504].includes(r.status_code)) {
      return "TRANSIENT";
    }
    return "CLIENT_ERROR";
  }

  const specTestCases: SpecTestCase[] = [
    {
      name: "Retry eventually succeeds",
      given: { exponential_base: 1 },
      responses: [
        { response: { status_code: 500 }, expected: { outcome: "retry_request", retry_quota: 486, delay: 0.05 } },
        { response: { status_code: 500 }, expected: { outcome: "retry_request", retry_quota: 472, delay: 0.1 } },
        { response: { status_code: 200 }, expected: { outcome: "success", retry_quota: 486 } },
      ],
    },
    {
      name: "Fail due to max attempts reached",
      given: { exponential_base: 1 },
      responses: [
        { response: { status_code: 502 }, expected: { outcome: "retry_request", retry_quota: 486, delay: 0.05 } },
        { response: { status_code: 502 }, expected: { outcome: "retry_request", retry_quota: 472, delay: 0.1 } },
        { response: { status_code: 502 }, expected: { outcome: "max_attempts_exceeded", retry_quota: 472 } },
      ],
    },
    {
      name: "Retry Quota reached after a single retry",
      given: { initial_retry_tokens: 14, exponential_base: 1 },
      responses: [
        { response: { status_code: 500 }, expected: { outcome: "retry_request", retry_quota: 0, delay: 0.05 } },
        { response: { status_code: 500 }, expected: { outcome: "retry_quota_exceeded", retry_quota: 0 } },
      ],
    },
    {
      name: "No retries at all if retry quota is 0",
      given: { initial_retry_tokens: 0, exponential_base: 1 },
      responses: [{ response: { status_code: 500 }, expected: { outcome: "retry_quota_exceeded", retry_quota: 0 } }],
    },
    {
      name: "Verifying exponential backoff timing",
      given: { max_attempts: 5, exponential_base: 1 },
      responses: [
        { response: { status_code: 500 }, expected: { outcome: "retry_request", retry_quota: 486, delay: 0.05 } },
        { response: { status_code: 500 }, expected: { outcome: "retry_request", retry_quota: 472, delay: 0.1 } },
        { response: { status_code: 500 }, expected: { outcome: "retry_request", retry_quota: 458, delay: 0.2 } },
        { response: { status_code: 500 }, expected: { outcome: "retry_request", retry_quota: 444, delay: 0.4 } },
        { response: { status_code: 500 }, expected: { outcome: "max_attempts_exceeded", retry_quota: 444 } },
      ],
    },
    {
      name: "Retry Stops After Retry Quota Exhaustion",
      given: { max_attempts: 5, initial_retry_tokens: 20, exponential_base: 1 },
      responses: [
        { response: { status_code: 500 }, expected: { outcome: "retry_request", retry_quota: 6, delay: 0.05 } },
        { response: { status_code: 502 }, expected: { outcome: "retry_quota_exceeded", retry_quota: 6 } },
      ],
    },
    {
      name: "Retry quota Recovery After Successful Responses",
      given: { max_attempts: 5, initial_retry_tokens: 30, exponential_base: 1 },
      responses: [
        { response: { status_code: 500 }, expected: { outcome: "retry_request", retry_quota: 16, delay: 0.05 } },
        { response: { status_code: 502 }, expected: { outcome: "retry_request", retry_quota: 2, delay: 0.1 } },
        { response: { status_code: 200 }, expected: { outcome: "success", retry_quota: 16 } },
        { response: { status_code: 500 }, expected: { outcome: "retry_request", retry_quota: 2, delay: 0.05 } },
        { response: { status_code: 200 }, expected: { outcome: "success", retry_quota: 16 } },
      ],
    },
    {
      name: "Throttling Error Token Bucket Drain (5 tokens) and Backoff Duration (1000ms)",
      given: { exponential_base: 1 },
      responses: [
        {
          response: { status_code: 400, error_code: "Throttling" },
          expected: { outcome: "retry_request", retry_quota: 495, delay: 1 },
        },
        { response: { status_code: 200 }, expected: { outcome: "success", retry_quota: 500 } },
      ],
    },
  ];

  let defaultRetryV2026Flag: boolean;

  beforeAll(() => {
    defaultRetryV2026Flag = Retry.v2026;
    Retry.v2026 = true;
    process.env.SMITHY_NEW_RETRIES_2026 = "true";
  });

  afterAll(() => {
    Retry.v2026 = defaultRetryV2026Flag;
    if (!defaultRetryV2026Flag) {
      delete process.env.SMITHY_NEW_RETRIES_2026;
    }
  });

  describe("StandardRetryStrategy unit tests", () => {
    for (const tc of specTestCases) {
      describe(tc.name, () => {
        let strategy: StandardRetryStrategy;
        let currentToken: StandardRetryToken;

        beforeAll(() => {
          strategy = new StandardRetryStrategy({
            maxAttempts: tc.given.max_attempts ?? 3,
            backoff: new DeterministicRetryBackoffStrategy(),
          });
          if (tc.given.initial_retry_tokens !== undefined) {
            (strategy as any).capacity = tc.given.initial_retry_tokens;
          }
        });

        for (let i = 0; i < tc.responses.length; i++) {
          const step = tc.responses[i];
          const { outcome, retry_quota, delay } = step.expected;
          const isNewSequence = i === 0 || tc.responses[i - 1].expected.outcome === "success";

          it(`step ${i}: ${outcome} (status=${step.response.status_code})`, async () => {
            if (isNewSequence) {
              currentToken = await strategy.acquireInitialRetryToken("none");
            }

            if (outcome === "success") {
              strategy.recordSuccess(currentToken);
              expect(strategy.getCapacity()).toEqual(retry_quota);
              return;
            }

            if (outcome === "retry_request") {
              const errorType = errorTypeForResponse(step.response);
              currentToken = await strategy.refreshRetryTokenForRetry(currentToken, { errorType });
              expect(strategy.getCapacity()).toEqual(retry_quota);
              expect(currentToken.getRetryDelay()).toEqual(delay! * 1000);
              return;
            }

            // max_attempts_exceeded or retry_quota_exceeded
            const errorType = errorTypeForResponse(step.response);
            await expect(strategy.refreshRetryTokenForRetry(currentToken, { errorType })).rejects.toThrow();
            expect(strategy.getCapacity()).toEqual(retry_quota);
          });
        }
      });
    }
  });

  describe("end-to-end with requireRequestsFrom", () => {
    function createCborResponse(body: any, status = 200, headers: Record<string, string> = {}) {
      const bytes = cbor.serialize(body);
      return new HttpResponse({
        headers: { "smithy-protocol": "rpc-v2-cbor", ...headers },
        body: Readable.from(bytes),
        statusCode: status,
      });
    }

    /**
     * Asserts that the actual value is within ±10% of the expected value.
     */
    const expectApprox = (actual: number, expected: number) => {
      expect(actual).toBeGreaterThanOrEqual(expected * 0.9);
      expect(actual).toBeLessThanOrEqual(expected * 1.1);
    };

    it("Retry eventually succeeds (3 attempts)", async () => {
      const client = new XYZService({
        endpoint: "https://localhost/nowhere",
        apiKey: { apiKey: "test-api-key" },
        retryStrategy: new StandardRetryStrategy({
          maxAttempts: 3,
          backoff: new DeterministicRetryBackoffStrategy(),
        }),
      });

      requireRequestsFrom(client)
        .toMatch({ hostname: /localhost/ })
        .respondWith(
          createCborResponse({ __type: "RetryableError" }, 500),
          createCborResponse({ __type: "RetryableError" }, 500),
          createCborResponse("", 200)
        );

      const response = await client.getNumbers().catch((e) => e);
      expect(response.$metadata.attempts).toEqual(3);
      // 2 transient retries: 50ms + 100ms = 150ms
      expectApprox(response.$metadata.totalRetryDelay, 150);
    });

    it("Fail due to max attempts reached (3 attempts, all 502)", async () => {
      const client = new XYZService({
        endpoint: "https://localhost/nowhere",
        apiKey: { apiKey: "test-api-key" },
        retryStrategy: new StandardRetryStrategy({
          maxAttempts: 3,
          backoff: new DeterministicRetryBackoffStrategy(),
        }),
      });

      requireRequestsFrom(client)
        .toMatch({ hostname: /localhost/ })
        .respondWith(
          createCborResponse({ __type: "RetryableError" }, 502),
          createCborResponse({ __type: "RetryableError" }, 502),
          createCborResponse({ __type: "RetryableError" }, 502)
        );

      const response = await client.getNumbers().catch((e) => e);
      expect(response.$metadata.attempts).toEqual(3);
      expect(response.name).toEqual("RetryableError");
      // 2 transient retries: 50ms + 100ms = 150ms
      expectApprox(response.$metadata.totalRetryDelay, 150);
    });

    it("Throttling error retries and succeeds", async () => {
      const client = new XYZService({
        endpoint: "https://localhost/nowhere",
        apiKey: { apiKey: "test-api-key" },
        retryStrategy: new StandardRetryStrategy({
          maxAttempts: 3,
          backoff: new DeterministicRetryBackoffStrategy(),
        }),
      });

      requireRequestsFrom(client)
        .toMatch({ hostname: /localhost/ })
        .respondWith(createCborResponse({ __type: "CodedThrottlingError" }, 429), createCborResponse("", 200));

      const response = await client.getNumbers().catch((e) => e);
      expect(response.$metadata.attempts).toEqual(2);
      // 1 throttling retry: 1000ms
      expectApprox(response.$metadata.totalRetryDelay, 1000);
    });

    it("x-amz-retry-after header is honored", async () => {
      const client = new XYZService({
        endpoint: "https://localhost/nowhere",
        apiKey: { apiKey: "test-api-key" },
        retryStrategy: new StandardRetryStrategy({
          maxAttempts: 3,
          backoff: new DeterministicRetryBackoffStrategy(),
        }),
      });

      requireRequestsFrom(client)
        .toMatch({ hostname: /localhost/ })
        .respondWith(
          createCborResponse({ __type: "RetryableError" }, 500, { "x-amz-retry-after": "1500" }),
          createCborResponse("", 200)
        );

      const response = await client.getNumbers().catch((e) => e);
      expect(response.$metadata.attempts).toEqual(2);
      // x-amz-retry-after=1500ms, clamped to max(50, min(1500, 50+5000)) = 1500ms
      expectApprox(response.$metadata.totalRetryDelay, 1500);
    });

    it("Invalid x-amz-retry-after falls back to exponential backoff", async () => {
      const client = new XYZService({
        endpoint: "https://localhost/nowhere",
        apiKey: { apiKey: "test-api-key" },
        retryStrategy: new StandardRetryStrategy({
          maxAttempts: 3,
          backoff: new DeterministicRetryBackoffStrategy(),
        }),
      });

      requireRequestsFrom(client)
        .toMatch({ hostname: /localhost/ })
        .respondWith(
          createCborResponse({ __type: "RetryableError" }, 500, { "x-amz-retry-after": "invalid" }),
          createCborResponse("", 200)
        );

      const response = await client.getNumbers().catch((e) => e);
      expect(response.$metadata.attempts).toEqual(2);
      // Invalid header ignored, falls back to transient backoff: 50ms
      expectApprox(response.$metadata.totalRetryDelay, 50);
    });
  });
});
