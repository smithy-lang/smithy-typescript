import { cbor } from "@smithy/core/cbor";
import { HttpResponse } from "@smithy/protocol-http";
import { requireRequestsFrom } from "@smithy/util-test/src";
import { Readable } from "node:stream";
import { describe, expect, test as it } from "vitest";
import { XYZService } from "xyz";

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
