import { op, TypeRegistry } from "@smithy/core/schema";
import { HttpRequest, HttpResponse } from "@smithy/core/protocols";
import type {
  $SchemaRef,
  BlobSchema,
  BooleanSchema,
  MapSchemaModifier,
  NumericSchema,
  ResponseMetadata,
  RetryableTrait,
  StaticErrorSchema,
  StaticOperationSchema,
  StaticStructureSchema,
  StringSchema,
  TimestampDefaultSchema,
} from "@smithy/types";
import { beforeEach, describe, expect, test as it } from "vitest";

import { SmithyRpcV2CborProtocol } from "./SmithyRpcV2CborProtocol";
import { cbor } from "./cbor";
import { dateToTag } from "./parseCborBody";

describe(SmithyRpcV2CborProtocol.name, () => {
  const bytes = (arr: number[]) => Buffer.from(arr);

  describe("serialization", () => {
    const testCases: Array<{
      name: string;
      schema: $SchemaRef;
      input: any;
      expected: {
        request: any;
        body: any;
      };
    }> = [
      {
        name: "document with timestamp and blob",
        schema: [
          3,
          "",
          "MyExtendedDocument",
          {},
          ["timestamp", "blob"],
          [
            [4 satisfies TimestampDefaultSchema, 0],
            [21 satisfies BlobSchema, 0],
          ],
        ],
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
        schema: [
          3,
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
          ],
        ],
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
        schema: [
          3,
          "",
          "MyShape",
          0,
          ["mySparseList", "myRegularList", "mySparseMap", "myRegularMap"],
          [
            [() => [1, "", "MySparseList", { sparse: 1 }, 1 satisfies NumericSchema], {}],
            [() => [1, "", "MyList", {}, 1 satisfies NumericSchema], {}],
            [() => [2, "", "MySparseMap", { sparse: 1 }, 0 satisfies StringSchema, 1 satisfies NumericSchema], {}],
            [() => [2, "", "MyMap", {}, 0 satisfies StringSchema, 1 satisfies NumericSchema], {}],
          ],
        ],
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
        // Sparseness is not checked on deserialization, also see this smithy change: https://github.com/smithy-lang/smithy/pull/2972
        name: "sparseness is not checked on deserialization",
        schema: [
          3,
          "",
          "MyShape",
          0,
          ["mySparseList", "myRegularList", "mySparseMap", "myRegularMap"],
          [
            [() => [1, "", "MyList", { sparse: 1 }, 1 satisfies NumericSchema], {}],
            [() => [1, "", "MyList", {}, 1 satisfies NumericSchema], {}],
            [() => [2, "", "MyMap", { sparse: 1 }, 0 satisfies StringSchema, 1 satisfies NumericSchema], {}],
            [() => [2, "", "MyMap", {}, 0 satisfies StringSchema, 1 satisfies NumericSchema], {}],
          ],
        ] satisfies StaticStructureSchema,
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

    const staticOperation = [
      9,
      "ns",
      "OperationWithModeledException",
      {},
      [3, "ns", "Input", 0, [], []],
      [3, "ns", "Output", 0, [], []],
    ] satisfies StaticOperationSchema;

    const operation = op(
      staticOperation[1],
      staticOperation[2],
      staticOperation[3],
      staticOperation[4],
      staticOperation[5]
    );

    const errorResponse = new HttpResponse({
      statusCode: 400,
      headers: {},
      body: cbor.serialize({
        __type: "ns#ModeledException",
        modeledProperty: "oh no",
      }),
    });

    const errorResponseNoDiscriminator = new HttpResponse({
      statusCode: 404,
      headers: {},
      body: cbor.serialize({
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

    // protected access.
    const registry = (protocol as any as { compositeErrorRegistry: TypeRegistry }).compositeErrorRegistry;

    beforeEach(() => {
      registry.clear();
    });

    const modeledExceptionSchema = [
      -3,
      "ns",
      "ModeledException",
      0,
      ["modeledProperty"],
      [0],
    ] satisfies StaticErrorSchema;
    const baseServiceExceptionSchema = [
      -3,
      "smithy.ts.sdk.synthetic.ns",
      "BaseServiceException",
      0,
      [],
      [],
    ] satisfies StaticErrorSchema;

    it("should throw the schema error ctor if one exists", async () => {
      // this is for modeled exceptions.
      registry.registerError(modeledExceptionSchema, ModeledExceptionCtor);
      registry.registerError(baseServiceExceptionSchema, ServiceBaseException);

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
      registry.registerError(baseServiceExceptionSchema, ServiceBaseException);

      try {
        await protocol.deserializeResponse(operation, serdeContext as any, errorResponseNoDiscriminator);
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

  // Exercises HttpProtocol#resolveError through its concrete implementation
  // (SmithyRpcV2CborProtocol#handleError). These cases target the registry/namespace
  // scanning branches that the "error handling" block above does not distinguish:
  // the "*" wildcard namespace, the parsed-namespace lookup, resolution from a
  // non-composite preferred registry, and the "schema found but no ctor -> synthetic"
  // path. The three resolution modes ("modeled", "synthetic", "native") are all hit.
  describe("resolveError (via handleError)", () => {
    const defaultNamespace = "resolve.default";
    const protocol = new SmithyRpcV2CborProtocol({ defaultNamespace });

    const staticOperation = [
      9,
      defaultNamespace,
      "OperationWithModeledException",
      {},
      [3, defaultNamespace, "Input", 0, [], []],
      [3, defaultNamespace, "Output", 0, [], []],
    ] satisfies StaticOperationSchema;

    const operation = op(
      staticOperation[1],
      staticOperation[2],
      staticOperation[3],
      staticOperation[4],
      staticOperation[5]
    );

    const serdeContext = {};

    class ServiceBaseException extends Error {
      public readonly $fault: "client" | "server" = "client";
      public $response?: HttpResponse;
      public $metadata: ResponseMetadata = {};
    }
    class ModeledExceptionCtor extends ServiceBaseException {
      public modeledProperty = "";
    }

    // Namespaces touched by these tests. registerError/register write into both the
    // composite registry AND TypeRegistry.for(ns) (the global map), which persists
    // across tests, so every touched namespace registry must be cleared each time.
    const touchedNamespaces = [
      defaultNamespace,
      "resolve.wild",
      "resolve.qualified",
      "resolve.nsonly",
      "resolve.noctor",
      "smithy.ts.sdk.synthetic." + defaultNamespace,
      "smithy.ts.sdk.synthetic.resolve.noctor",
    ];

    const composite = (protocol as any as { compositeErrorRegistry: TypeRegistry }).compositeErrorRegistry;

    beforeEach(() => {
      composite.clear();
      for (const ns of touchedNamespaces) {
        TypeRegistry.for(ns).clear();
      }
    });

    const errorWith = (type: string | undefined, statusCode = 400) =>
      new HttpResponse({
        statusCode,
        headers: {},
        body: cbor.serialize({
          ...(type !== undefined ? { __type: type } : {}),
          modeledProperty: "detail",
          message: "boom",
        }),
      });

    it("resolves an unqualified discriminator via the '*' wildcard namespace (modeled)", async () => {
      // Schema lives under a namespace that is neither the parsed namespace (there is
      // none) nor the default. Only the "*" branch, which does an unqualified lookup,
      // can find it, and only because it is the single candidate ending in "#Name".
      const schema = [-3, "resolve.wild", "WildcardException", 0, ["modeledProperty"], [0]] satisfies StaticErrorSchema;
      composite.registerError(schema, ModeledExceptionCtor);

      await expect(
        protocol.deserializeResponse(operation, serdeContext as any, errorWith("WildcardException"))
      ).rejects.toBeInstanceOf(ModeledExceptionCtor);
    });

    it("resolves a namespace-qualified discriminator that differs from the default (modeled)", async () => {
      const schema = [
        -3,
        "resolve.qualified",
        "QualifiedException",
        0,
        ["modeledProperty"],
        [0],
      ] satisfies StaticErrorSchema;
      composite.registerError(schema, ModeledExceptionCtor);

      let caught: any;
      try {
        await protocol.deserializeResponse(
          operation,
          serdeContext as any,
          errorWith("resolve.qualified#QualifiedException")
        );
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ModeledExceptionCtor);
      expect(caught.modeledProperty).toEqual("detail");
    });

    it("resolves from a preferred registry other than the composite (default-namespace registry)", async () => {
      // Register only into TypeRegistry.for(defaultNamespace) - NOT the composite.
      // The composite is scanned first and misses; resolution must fall through to the
      // third registry in the preferred list.
      const schema = [-3, defaultNamespace, "NsOnlyException", 0, ["modeledProperty"], [0]] satisfies StaticErrorSchema;
      TypeRegistry.for(defaultNamespace).registerError(schema, ModeledExceptionCtor);
      // Guard: the schema is not in the composite.
      expect(() => composite.getSchema(defaultNamespace + "#NsOnlyException")).toThrow();

      await expect(
        protocol.deserializeResponse(operation, serdeContext as any, errorWith(defaultNamespace + "#NsOnlyException"))
      ).rejects.toBeInstanceOf(ModeledExceptionCtor);
    });

    it("falls back to the synthetic base exception when a schema is found but has no ctor", async () => {
      // A plain (non-error) schema claims the qualified key via register(), so getSchema
      // succeeds but getErrorCtor returns undefined. A synthetic base exception is present,
      // so resolveError returns mode "synthetic".
      const listSchema = [1, "resolve.noctor", "NoCtorException", 0, 0] as any;
      composite.register("resolve.noctor#NoCtorException", listSchema);
      const baseSchema = [
        -3,
        "smithy.ts.sdk.synthetic.resolve.noctor",
        "BaseServiceException",
        0,
        [],
        [],
      ] satisfies StaticErrorSchema;
      composite.registerError(baseSchema, ServiceBaseException);

      let caught: any;
      try {
        await protocol.deserializeResponse(operation, serdeContext as any, errorWith("resolve.noctor#NoCtorException"));
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ServiceBaseException);
      // synthetic path copies dataObject onto the thrown error.
      expect(caught.message).toEqual("boom");
    });

    it("falls back to a native Error when no schema and no base exception are available (native)", async () => {
      let caught: any;
      try {
        await protocol.deserializeResponse(operation, serdeContext as any, errorWith("resolve.qualified#Absent"));
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(Error);
      expect(caught).not.toBeInstanceOf(ServiceBaseException);
      // native path constructs new Error(errorShapeName), but dataObject is then
      // assigned over it, so dataObject.message wins.
      expect(caught.message).toEqual("boom");
    });

    it("uses the error shape name as the native Error message when the body has none", async () => {
      // No __type and no message in the body: discriminator becomes "Unknown",
      // and the native Error keeps that name since dataObject has no message to assign.
      const response = new HttpResponse({
        statusCode: 400,
        headers: {},
        body: cbor.serialize({ modeledProperty: "detail" }),
      });
      let caught: any;
      try {
        await protocol.deserializeResponse(operation, serdeContext as any, response);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(Error);
      expect(caught).not.toBeInstanceOf(ServiceBaseException);
      expect(caught.message).toEqual("Unknown");
    });

    it("uses a preferred registry's base exception when no schema matches at all (post-scan synthetic)", async () => {
      // No schema is registered for the discriminator anywhere, so the first
      // registry/namespace scan finds nothing. The second loop then returns the
      // default-namespace registry's synthetic base exception.
      const baseSchema = [
        -3,
        "smithy.ts.sdk.synthetic." + defaultNamespace,
        "BaseServiceException",
        0,
        [],
        [],
      ] satisfies StaticErrorSchema;
      TypeRegistry.for(defaultNamespace).registerError(baseSchema, ServiceBaseException);

      let caught: any;
      try {
        await protocol.deserializeResponse(
          operation,
          serdeContext as any,
          errorWith("resolve.qualified#TotallyUnknown")
        );
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ServiceBaseException);
      expect(caught.message).toEqual("boom");
    });

    it("classifies status code 500 as a server fault", async () => {
      let caught: any;
      try {
        await protocol.deserializeResponse(operation, serdeContext as any, errorWith("resolve.qualified#Absent", 500));
      } catch (e) {
        caught = e;
      }
      expect(caught.$fault).toEqual("server");
    });

    it("classifies status code 499 as a client fault", async () => {
      let caught: any;
      try {
        await protocol.deserializeResponse(operation, serdeContext as any, errorWith("resolve.qualified#Absent", 499));
      } catch (e) {
        caught = e;
      }
      expect(caught.$fault).toEqual("client");
    });
  });
});
