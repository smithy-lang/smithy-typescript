import { HttpRequest } from "@smithy/protocol-http";
import { describe, expect,test as it } from "vitest";

import { requestBuilder } from "./requestBuilder";

describe(requestBuilder.name, () => {
  it("can build requests", async () => {
    expect(
      await requestBuilder(
        {
          Key: "MyKey",
          Bucket: "MyBucket",
        },
        {
          endpoint: async () => {
            return {
              hostname: "localhost",
              protocol: "https",
              port: 8080,
              path: "/a",
            };
          },
        } as any
      )
        .bp("/{Key+}")
        .p("Bucket", () => "MyBucket", "{Bucket}", false)
        .p("Key", () => "MyKey", "{Key+}", false)
        .m("PUT")
        .h({
          "my-header": "my-header-value",
        })
        .q({
          "my-query": "my-query-value",
        })
        .b("test-body")
        .build()
    ).toEqual(
      new HttpRequest({
        protocol: "https",
        hostname: "localhost",
        port: 8080,
        method: "PUT",
        path: "/a/MyKey",
        query: {
          "my-query": "my-query-value",
        },
        headers: {
          "my-header": "my-header-value",
        },
        body: "test-body",
      })
    );
  });
});
