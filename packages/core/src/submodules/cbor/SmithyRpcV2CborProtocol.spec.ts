import { list, map, struct } from "@smithy/core/schema";
import { HttpRequest, HttpResponse } from "@smithy/protocol-http";
import { SchemaRef } from "@smithy/types";
import { toBase64 } from "@smithy/util-base64";
import { describe, expect, test as it } from "vitest";

import { cbor } from "./cbor";
import { dateToTag } from "./parseCborBody";
import { SmithyRpcV2CborProtocol } from "./SmithyRpcV2CborProtocol";

describe(SmithyRpcV2CborProtocol.name, () => {
  const bytes = (arr: number[]) => Buffer.from(arr);

  describe("serialization", () => {
    const testCases: Array<{
      name: string;
      schema: SchemaRef;
      input: any;
      expected: {
        request: any;
        body: any;
      };
    }> = [
      {
        name: "document with timestamp and blob",
        schema: struct(
          "MyExtendedDocument",
          {},
          {
            timestamp: [() => "time", {}],
            blob: [() => "blob", {}],
          }
        ),
        input: {
          bool: true,
          int: 5,
          float: -3.001,
          timestamp: new Date(1_000_000),
          blob: bytes([97, 98, 99, 100]),
        },
        expected: {
          request: {},
          body: {
            bool: true,
            int: 5,
            float: -3.001,
            timestamp: dateToTag(new Date(1_000_000)),
            blob: bytes([97, 98, 99, 100]),
          },
        },
      },
      {
        name: "write to header and query",
        schema: struct(
          "MyExtendedDocument",
          {},
          {
            bool: [, { httpQuery: "bool" }],
            timestamp: [
              () => "time",
              {
                httpHeader: "timestamp",
              },
            ],
            blob: [
              () => "blob",
              {
                httpHeader: "blob",
              },
            ],
            prefixHeaders: [, { httpPrefixHeaders: "anti-" }],
            searchParams: [, { httpQueryParams: {} }],
          }
        ),
        input: {
          bool: true,
          timestamp: new Date(1_000_000),
          blob: bytes([97, 98, 99, 100]),
          prefixHeaders: {
            pasto: "cheese dodecahedron",
            clockwise: "left",
          },
          searchParams: {
            a: 1,
            b: 2,
          },
        },
        expected: {
          request: {
            headers: {
              timestamp: new Date(1_000_000).toISOString(),
              blob: toBase64(bytes([97, 98, 99, 100])),
              "anti-clockwise": "left",
              "anti-pasto": "cheese dodecahedron",
            },
            query: { bool: "true", a: "1", b: "2" },
          },
          body: {},
        },
      },
      {
        name: "sparse list and map",
        schema: struct(
          "MyShape",
          {},
          {
            mySparseList: [() => list("MyList", { sparse: 1 }), {}],
            myRegularList: [() => list("MyList", {}), {}],
            mySparseMap: [() => map("MyMap", { sparse: 1 }), {}],
            myRegularMap: [() => map("MyMap", {}), {}],
          }
        ),
        input: {
          mySparseList: [null, 1, null, 2, null],
          myRegularList: [null, 1, null, 2, null],
          mySparseMap: {
            0: null,
            1: 1,
            2: null,
            3: 3,
            4: null,
          },
          myRegularMap: {
            0: null,
            1: 1,
            2: null,
            3: 3,
            4: null,
          },
        },
        expected: {
          request: {},
          body: {
            mySparseList: [null, 1, null, 2, null],
            myRegularList: [1, 2],
            mySparseMap: {
              0: null,
              1: 1,
              2: null,
              3: 3,
              4: null,
            },
            myRegularMap: {
              1: 1,
              3: 3,
            },
          },
        },
      },
    ];

    for (const testCase of testCases) {
      it(`should serialize HTTP Requests: ${testCase.name}`, async () => {
        const protocol = new SmithyRpcV2CborProtocol();
        const httpRequest = await protocol.serializeRequest(
          {
            input: testCase.schema,
            output: void 0,
            traits: {},
            errors: [],
          },
          testCase.input,
          {
            endpointV2: {
              url: new URL("https://example.com/"),
            },
          }
        );

        const body = httpRequest.body;
        httpRequest.body = void 0;

        expect(httpRequest).toEqual(
          new HttpRequest({
            protocol: "https:",
            hostname: "example.com",
            method: "POST",
            path: "/service/undefined/operation/undefined",
            ...testCase.expected.request,
            headers: {
              accept: "application/cbor",
              "content-type": "application/cbor",
              "smithy-protocol": "rpc-v2-cbor",
              "content-length": String(body.byteLength),
              ...testCase.expected.request.headers,
            },
          })
        );

        expect(cbor.deserialize(body)).toEqual(testCase.expected.body);
      });
    }
  });

  describe("deserialization", () => {
    const testCases = [
      {
        name: "sparse list and map",
        schema: struct(
          "MyShape",
          {},
          {
            mySparseList: [() => list("MyList", { sparse: 1 }), {}],
            myRegularList: [() => list("MyList", {}), {}],
            mySparseMap: [() => map("MyMap", { sparse: 1 }), {}],
            myRegularMap: [() => map("MyMap", {}), {}],
          }
        ),
        mockOutput: {
          mySparseList: [null, 1, null, 2, null],
          myRegularList: [null, 1, null, 2, null],
          mySparseMap: {
            0: null,
            1: 1,
            2: null,
            3: 3,
            4: null,
          },
          myRegularMap: {
            0: null,
            1: 1,
            2: null,
            3: 3,
            4: null,
          },
        },
        expected: {
          output: {
            mySparseList: [null, 1, null, 2, null],
            myRegularList: [1, 2],
            mySparseMap: {
              0: null,
              1: 1,
              2: null,
              3: 3,
              4: null,
            },
            myRegularMap: {
              1: 1,
              3: 3,
            },
          },
        },
      },
    ];

    for (const testCase of testCases) {
      it(`should deserialize HTTP Responses: ${testCase.name}`, async () => {
        const protocol = new SmithyRpcV2CborProtocol();
        const output = await protocol.deserializeResponse(
          {
            input: void 0,
            output: testCase.schema,
            traits: {},
            errors: [],
          },
          {},
          new HttpResponse({
            statusCode: 200,
            body: cbor.serialize(testCase.mockOutput),
          })
        );

        delete (output as Partial<typeof output>).$metadata;
        expect(output).toEqual(testCase.expected.output);
      });
    }
  });
});
