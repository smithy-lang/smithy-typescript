import { error, list, map, op, SCHEMA, struct, TypeRegistry } from "@smithy/core/schema";
import { HttpRequest, HttpResponse } from "@smithy/protocol-http";
import type {
  BlobSchema,
  BooleanSchema,
  MapSchemaModifier,
  NumericSchema,
  ResponseMetadata,
  RetryableTrait,
  SchemaRef,
  StringSchema,
  TimestampDefaultSchema,
} from "@smithy/types";
import { beforeEach, describe, expect, test as it } from "vitest";

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
          "",
          "MyExtendedDocument",
          {},
          ["timestamp", "blob"],
          [
            [4 satisfies TimestampDefaultSchema, 0],
            [21 satisfies BlobSchema, 0],
          ]
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
            timestamp: dateToTag(new Date(1_000_000)),
            blob: bytes([97, 98, 99, 100]),
          },
        },
      },
      {
        name: "do not write to header or query",
        schema: struct(
          "",
          "MyExtendedDocument",
          {},
          ["bool", "timestamp", "blob", "prefixHeaders", "searchParams"],
          [
            [2 satisfies BooleanSchema, { httpQuery: "bool" }],
            [4 satisfies TimestampDefaultSchema, { httpHeader: "timestamp" }],
            [21 satisfies BlobSchema, { httpHeader: "blob" }],
            [(128 satisfies MapSchemaModifier) | (0 satisfies StringSchema), { httpPrefixHeaders: "anti-" }],
            [(128 satisfies MapSchemaModifier) | (0 satisfies StringSchema), { httpQueryParams: 1 }],
          ]
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
            headers: {},
            query: {},
          },
          body: {
            bool: true,
            timestamp: dateToTag(new Date(1_000_000)),
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
        },
      },
      {
        name: "sparse list and map",
        schema: struct(
          "",
          "MyShape",
          0,
          ["mySparseList", "myRegularList", "mySparseMap", "myRegularMap"],
          [
            [() => list("", "MySparseList", { sparse: 1 }, 1 satisfies NumericSchema), {}],
            [() => list("", "MyList", {}, 1 satisfies NumericSchema), {}],
            [() => map("", "MySparseMap", { sparse: 1 }, 0 satisfies StringSchema, 1 satisfies NumericSchema), {}],
            [() => map("", "MyMap", {}, 0 satisfies StringSchema, 1 satisfies NumericSchema), {}],
          ]
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
        const protocol = new SmithyRpcV2CborProtocol({ defaultNamespace: "" });
        const httpRequest = await protocol.serializeRequest(
          {
            namespace: "ns",
            name: "dummy",
            input: testCase.schema,
            output: "unit",
            traits: {},
          },
          testCase.input,
          {
            async endpoint() {
              return {
                protocol: "https:",
                hostname: "example.com",
                path: "/",
              };
            },
          } as any
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
          "",
          "MyShape",
          0,
          ["mySparseList", "myRegularList", "mySparseMap", "myRegularMap"],
          [
            [() => list("", "MyList", { sparse: 1 }, 1 satisfies NumericSchema), {}],
            [() => list("", "MyList", {}, 1 satisfies NumericSchema), {}],
            [() => map("", "MyMap", { sparse: 1 }, 0 satisfies StringSchema, 1 satisfies NumericSchema), {}],
            [() => map("", "MyMap", {}, 0 satisfies StringSchema, 1 satisfies NumericSchema), {}],
          ]
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
        const protocol = new SmithyRpcV2CborProtocol({
          defaultNamespace: "",
        });
        const output = await protocol.deserializeResponse(
          {
            namespace: "ns",
            name: "dummy",
            input: "unit",
            output: testCase.schema,
            traits: {},
          },
          {} as any,
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

  describe("error handling", () => {
    const protocol = new SmithyRpcV2CborProtocol({ defaultNamespace: "ns" });

    const operation = op(
      "ns",
      "OperationWithModeledException",
      {},
      struct("ns", "Input", 0, [], []),
      struct("ns", "Output", 0, [], [])
    );

    const errorResponse = new HttpResponse({
      statusCode: 400,
      headers: {},
      body: cbor.serialize({
        __type: "ns#ModeledException",
        modeledProperty: "oh no",
      }),
    });

    const serdeContext = {};

    class ServiceBaseException extends Error {
      public readonly $fault: "client" | "server" = "client";
      public $response?: HttpResponse;
      public $retryable?: RetryableTrait;
      public $metadata: ResponseMetadata = {
        httpStatusCode: 400,
      };
    }

    class ModeledExceptionCtor extends ServiceBaseException {
      public modeledProperty: string = "";
    }

    const ns = TypeRegistry.for("ns");
    const synthetic = TypeRegistry.for("smithy.ts.sdk.synthetic.ns");

    beforeEach(() => {
      ns.clear();
    });

    const modeledExceptionSchema = error("ns", "ModeledException", 0, ["modeledProperty"], [0], null);
    const baseServiceExceptionSchema = error("smithy.ts.sdk.synthetic.ns", "BaseServiceException", 0, [], [], null);

    it("should throw the schema error ctor if one exists", async () => {
      // this is for modeled exceptions.

      ns.register(modeledExceptionSchema.getName(), modeledExceptionSchema);
      ns.registerError(modeledExceptionSchema, ModeledExceptionCtor);

      synthetic.register(baseServiceExceptionSchema.getName(), baseServiceExceptionSchema);
      synthetic.registerError(baseServiceExceptionSchema, ServiceBaseException);

      try {
        await protocol.deserializeResponse(operation, serdeContext as any, errorResponse);
      } catch (e) {
        expect(e).toBeInstanceOf(ModeledExceptionCtor);
        expect((e as ModeledExceptionCtor).modeledProperty).toEqual("oh no");
        expect(e).toBeInstanceOf(ServiceBaseException);
      }
      expect.assertions(3);
    });

    it("should throw a base error if available in the namespace, when no error schema is modeled", async () => {
      // this is the expected fallback case for all generated clients.

      synthetic.register(baseServiceExceptionSchema.getName(), baseServiceExceptionSchema);
      synthetic.registerError(baseServiceExceptionSchema, ServiceBaseException);

      try {
        await protocol.deserializeResponse(operation, serdeContext as any, errorResponse);
      } catch (e) {
        expect(e).toBeInstanceOf(ServiceBaseException);
      }
      expect.assertions(1);
    });

    it("should fall back to a generic JS Error as a last resort", async () => {
      // this shouldn't happen, but in case the type registry is mutated incorrectly.
      try {
        await protocol.deserializeResponse(operation, serdeContext as any, errorResponse);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
      expect.assertions(1);
    });
  });
});
