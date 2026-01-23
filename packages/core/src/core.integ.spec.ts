import { cbor, SmithyRpcV2CborProtocol } from "@smithy/core/cbor";
import type { HttpProtocol } from "@smithy/core/protocols";
import { HttpResponse } from "@smithy/protocol-http";
import { RpcV2ProtocolClient } from "@smithy/smithy-rpcv2-cbor-schema";
import { requireRequestsFrom } from "@smithy/util-test/src";
import { describe, expect, test as it } from "vitest";
import type { GetNumbersCommandOutput } from "xyz-schema";
import { XYZService } from "xyz-schema";

import { NumericValue } from "./submodules/serde";

describe("@smithy/core", () => {
  it("should normalize the config.protocol field", () => {
    const withInstance = new RpcV2ProtocolClient({
      endpoint: "https://localhost",
      protocol: new SmithyRpcV2CborProtocol({
        defaultNamespace: "smithy.protocoltests.rpcv2Cbor",
      }),
    });

    expect(withInstance.config.protocol).toBeInstanceOf(SmithyRpcV2CborProtocol);
    expect((withInstance.config.protocol as HttpProtocol).options.defaultNamespace).toEqual(
      "smithy.protocoltests.rpcv2Cbor"
    );

    const withCtor = new RpcV2ProtocolClient({
      endpoint: "https://localhost",
      protocol: SmithyRpcV2CborProtocol,
    });

    expect(withCtor.config.protocol).toBeInstanceOf(SmithyRpcV2CborProtocol);
    expect((withCtor.config.protocol as HttpProtocol).options.defaultNamespace).toEqual(
      "smithy.protocoltests.rpcv2Cbor"
    );

    const withSettings = new RpcV2ProtocolClient({
      endpoint: "https://localhost",
      protocolSettings: {
        defaultNamespace: "ns",
      },
    });

    expect(withCtor.config.protocol).toBeInstanceOf(SmithyRpcV2CborProtocol);
    expect((withSettings.config.protocol as HttpProtocol).options.defaultNamespace).toEqual("ns");
  });
});

describe("aggregated clients", () => {
  it("should contain paginator and waiter methods", async () => {
    const xyz = new XYZService({ endpoint: `https://localhost`, apiKey: async () => ({ apiKey: "test-key" }) });

    expect(xyz.paginateGetNumbers).toBeInstanceOf(Function);
    expect(xyz.waitUntilNumbersAligned).toBeInstanceOf(Function);

    const testHandler = requireRequestsFrom(xyz).toMatch({
      hostname: /^localhost$/,
    });
    for (const i of [0, 1, 2, 3, 4, 5, 6]) {
      testHandler.respondWith(
        new HttpResponse({
          headers: {
            "smithy-protocol": "rpc-v2-cbor",
          },
          statusCode: 200,
          body: cbor.serialize({
            bigInteger: BigInt("123"),
            bigDecimal: new NumericValue("123.456", "bigDecimal"),
            numbers: [1, 2, 3],
            nextToken: "nextToken" + i,
          } as GetNumbersCommandOutput),
        })
      );
    }
    testHandler.respondWith(
      new HttpResponse({
        headers: {
          "smithy-protocol": "rpc-v2-cbor",
        },
        statusCode: 200,
        body: cbor.serialize({} as GetNumbersCommandOutput),
      }),
      new HttpResponse({
        headers: {
          "smithy-protocol": "rpc-v2-cbor",
        },
        statusCode: 400,
        body: cbor.serialize({
          __type: "firstError",
        }),
      }),
      new HttpResponse({
        headers: {
          "smithy-protocol": "rpc-v2-cbor",
        },
        statusCode: 400,
        body: cbor.serialize({
          __type: "secondError",
        }),
      }),
      new HttpResponse({
        headers: {
          "smithy-protocol": "rpc-v2-cbor",
        },
        statusCode: 200,
        body: cbor.serialize({
          __type: "finalAwaited",
        }),
      })
    );

    // all args optional
    for await (const page of xyz.paginateGetNumbers()) {
      if (page.nextToken === "nextToken3") {
        break;
      }
    }

    for await (const page of xyz.paginateGetNumbers(
      {
        startToken: "token",
        maxResults: 10,
        bigDecimal: new NumericValue("0.0", "bigDecimal"),
        bigInteger: BigInt(100),
      },
      {
        stopOnSameToken: true,
        withCommand(command: any) {
          return command;
        },
      }
    )) {
      expect(page.$metadata).toBeDefined();
      expect(page.bigInteger).toBeDefined();
      expect(page.bigDecimal).toBeDefined();
      expect(page.numbers?.[0]).toBeDefined();
      expect(page.nextToken).toBeDefined();
      if (page.nextToken === "nextToken6") {
        break;
      }
    }

    await xyz.waitUntilNumbersAligned(
      {
        bigInteger: BigInt(1),
      },
      120
    );

    const result = await xyz.waitUntilNumbersAligned({}, { maxWaitTime: 8, minDelay: 0.001, maxDelay: 0.01 });
    expect(result.reason).toMatchObject({
      __type: "finalAwaited",
    });

    expect.assertions(29);
  });
}, 30_000);
