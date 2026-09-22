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
  it("should preserve the absolute shape id from __type", () => {
    const code = loadSmithyRpcV2CborErrorCode(
      { statusCode: 400, headers: {} },
      {
        __type: "com.example#OhNoException",
      }
    );
    expect(code).toEqual("com.example#OhNoException");
  });

  it("should trim a trailing tag/version suffix but keep the namespace", () => {
    const code = loadSmithyRpcV2CborErrorCode(
      { statusCode: 400, headers: {} },
      {
        __type: "com.example#OhNoException:Sender",
      }
    );
    expect(code).toEqual("com.example#OhNoException");
  });

  it("should not use a Code/code body field (spec forbids it)", () => {
    const code = loadSmithyRpcV2CborErrorCode(
      { statusCode: 400, headers: {} },
      {
        cOdE: "OhNoException:Sender",
      }
    );
    expect(code).toBeUndefined();
  });
});
