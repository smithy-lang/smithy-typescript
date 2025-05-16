import { describe, expect, test as it } from "vitest";

import { buildHttpRpcRequest, loadSmithyRpcV2CborErrorCode } from "./parseCborBody";

describe("buildHttpRpcRequest", () => {
  it("should copy the input headers", async () => {
    const headers = {
      "content-type": "application/cbor",
      "smithy-protocol": "rpc-v2-cbor",
      accept: "application/cbor",
      "content-length": "0",
    };

    const request = await buildHttpRpcRequest(
      {
        async endpoint() {
          return {
            hostname: "https://localhost",
            path: "/",
          };
        },
      } as any,
      headers,
      "/",
      "",
      ""
    );

    expect(request.headers).toEqual(headers);
    expect(request.headers).not.toBe(headers);
  });
});

describe(loadSmithyRpcV2CborErrorCode.name, () => {
  it("should read the code field case-insensitively", () => {
    const code = loadSmithyRpcV2CborErrorCode(
      { statusCode: 200, headers: {} },
      {
        cOdE: "OhNoException:Sender",
      }
    );
    expect(code).toEqual("OhNoException");
  });
});
