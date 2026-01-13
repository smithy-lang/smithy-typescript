import { cbor } from "@smithy/core/cbor";
import { HttpResponse } from "@smithy/protocol-http";
import { RpcV2Protocol as MICGClient } from "@smithy/smithy-rpcv2-cbor";
import { RpcV2Protocol } from "@smithy/smithy-rpcv2-cbor-schema";
import { requireRequestsFrom } from "@smithy/util-test/src";
import { describe, expect, test as it, vi } from "vitest";

import { getRuntimeTypecheckPlugin } from "./getRuntimeTypecheckPlugin";

describe("schema-based runtime typecheck integration test", () => {
  it("should detect type mismatches", async () => {
    const logger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      trace: vi.fn(),
    };
    const client = new RpcV2Protocol({
      endpoint: "https://localhost",
      logger,
    });

    requireRequestsFrom(client)
      .toMatch({
        hostname: /localhost/,
      })
      .respondWith(
        new HttpResponse({
          headers: {
            "smithy-protocol": "rpc-v2-cbor",
          },
          statusCode: 200,
          body: cbor.serialize({
            nested: {
              foo: 5,
            },
          }),
        })
      );

    client.middlewareStack.use(
      getRuntimeTypecheckPlugin({
        logger,
        input: "warn",
        output: "info",
      })
    );

    const output = await client.recursiveShapes({
      nested: {
        foo: 0,
        nested: {
          bar: 0,
          recursiveMember: {
            nested: { foo: 1, extra1: 0, bar: 0, recursiveMember: {} },
          },
        },
      },
    } as any);

    expect(output).toEqual({
      $metadata: {
        attempts: 1,
        cfId: undefined,
        extendedRequestId: undefined,
        httpStatusCode: 200,
        requestId: undefined,
        totalRetryDelay: 0,
      },
      nested: {
        foo: 5,
      },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      "RpcV2ProtocolClient->RecursiveShapesCommand input validation: \n" +
        "\t{}.nested.foo: expected string, got number.\n" +
        "\t{}.nested.nested.bar: expected string, got number.\n" +
        "\t{}.nested.nested.recursiveMember.nested: unmatched keys: foo, extra1.\n" +
        "\t{}.nested.nested.recursiveMember.nested.bar: expected string, got number."
    );

    expect(logger.info).toHaveBeenCalledWith(
      "RpcV2ProtocolClient->RecursiveShapesCommand output validation: \n" +
        "\t{}.nested.foo: expected string, got number."
    );
  });

  it("can be configured to throw an error", async () => {
    const logger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      trace: vi.fn(),
    };
    const client = new RpcV2Protocol({
      endpoint: "https://localhost",
      logger,
    });

    requireRequestsFrom(client)
      .toMatch({
        hostname: /localhost/,
      })
      .respondWith(
        new HttpResponse({
          headers: {
            "smithy-protocol": "rpc-v2-cbor",
          },
          statusCode: 200,
          body: cbor.serialize({
            nested: {
              foo: 5,
            },
          }),
        })
      );

    client.middlewareStack.use(
      getRuntimeTypecheckPlugin({
        logger,
        input: "throw",
        output: "info",
      })
    );

    await expect(() =>
      client.recursiveShapes({
        nested: {
          foo: 0,
          nested: {
            bar: 0,
            recursiveMember: {
              nested: { foo: 1, extra1: 0, bar: 0, recursiveMember: {} },
            },
          },
        },
      } as any)
    ).rejects.toThrowError(
      "RpcV2ProtocolClient->RecursiveShapesCommand input validation: \n" +
        "\t{}.nested.foo: expected string, got number.\n" +
        "\t{}.nested.nested.bar: expected string, got number.\n" +
        "\t{}.nested.nested.recursiveMember.nested: unmatched keys: foo, extra1.\n" +
        "\t{}.nested.nested.recursiveMember.nested.bar: expected string, got number."
    );

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("should notify when an incompatible client is used", async () => {
    const logger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      trace: vi.fn(),
    };
    const client = new MICGClient({
      endpoint: "https://localhost",
      logger,
    });

    requireRequestsFrom(client)
      .toMatch({
        hostname: /localhost/,
      })
      .respondWith(
        new HttpResponse({
          headers: {
            "smithy-protocol": "rpc-v2-cbor",
          },
          statusCode: 200,
          body: cbor.serialize({
            nested: {
              foo: "5",
            },
          }),
        })
      );

    client.middlewareStack.use(
      getRuntimeTypecheckPlugin({
        logger,
        input: "warn",
        output: "info",
      })
    );

    await expect(() =>
      client.recursiveShapes({
        nested: {
          foo: 0,
          nested: {
            bar: 0,
            recursiveMember: {
              nested: { foo: 1, extra1: 0, bar: 0, recursiveMember: {} },
            },
          },
        },
      } as any)
    ).rejects.toThrowError("@smithy/typecheck::rttcMiddleware - unsupported client version.");
  });
});
