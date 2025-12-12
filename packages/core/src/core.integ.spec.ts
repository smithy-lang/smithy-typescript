import { SmithyRpcV2CborProtocol } from "@smithy/core/cbor";
import type { HttpProtocol } from "@smithy/core/protocols";
import { RpcV2ProtocolClient } from "@smithy/smithy-rpcv2-cbor-schema";
import { describe, expect, test as it } from "vitest";

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
