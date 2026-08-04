import { RestServerProtocol } from "./RestServerProtocol";
import { SerializationException, UnsupportedMediaTypeException } from "../../errors";
import type { HttpRequest as IHttpRequest, HttpResponse as IHttpResponse, $OperationSchema } from "@smithy/types";

/**
 * Concrete subclass for testing abstract RestServerProtocol.
 */
class TestRestProtocol extends RestServerProtocol {
  public writtenSchema: any;
  public writtenValue: any;

  protected serializer: any = {
    write: (schema: any, value: any) => {
      this.writtenSchema = schema;
      this.writtenValue = value;
    },
    flush: () => new Uint8Array([99]),
    setSerdeContext() {},
  };
  protected deserializer: any = {
    read: (_schema: any, _bytes: Uint8Array) => ({}),
    setSerdeContext() {},
  };
  protected stringDeserializer: any = {
    read: (_schema: any, data: string) => data,
  };

  constructor() {
    super({ defaultNamespace: "test.namespace" });
  }

  public getShapeId(): string {
    return "test#RestJson";
  }

  protected getDefaultContentType(): string {
    return "application/json";
  }

  protected async serializeError<E extends Error>(): Promise<IHttpResponse> {
    return { statusCode: 500, headers: {} } as any;
  }

  // Expose protected for testing.
  public testExtractPathLabels(schema: $OperationSchema, path: string) {
    return this.extractPathLabels(schema, path);
  }
}

function makeRequest(overrides: Partial<IHttpRequest> = {}): IHttpRequest {
  return {
    method: "GET",
    path: "/",
    headers: {},
    query: {},
    body: undefined,
    ...overrides,
  } as any;
}

function makeContext(): any {
  return {
    streamCollector: async (stream: any) => {
      if (stream instanceof Uint8Array) return stream;
      if (stream === undefined || stream === null) return new Uint8Array(0);
      return new Uint8Array(0);
    },
  };
}

describe("RestServerProtocol", () => {
  let protocol: TestRestProtocol;

  beforeEach(() => {
    protocol = new TestRestProtocol();
  });

  describe("extractPathLabels", () => {
    function makeOpSchema(uri: string): $OperationSchema {
      return {
        namespace: "test",
        name: "TestOp",
        traits: { http: ["GET", uri, 200] },
        input: {},
        output: {},
      } as unknown as $OperationSchema;
    }

    it("extracts a single label", () => {
      const result = protocol.testExtractPathLabels(makeOpSchema("/items/{itemId}"), "/items/abc");
      expect(result).toEqual({ itemId: "abc" });
    });

    it("extracts multiple labels", () => {
      const result = protocol.testExtractPathLabels(
        makeOpSchema("/items/{itemId}/reviews/{reviewId}"),
        "/items/beer1/reviews/rev42"
      );
      expect(result).toEqual({ itemId: "beer1", reviewId: "rev42" });
    });

    it("decodes percent-encoded values", () => {
      const result = protocol.testExtractPathLabels(makeOpSchema("/items/{id}"), "/items/hello%20world");
      expect(result).toEqual({ id: "hello world" });
    });

    it("handles greedy labels ({key+})", () => {
      const result = protocol.testExtractPathLabels(makeOpSchema("/bucket/{key+}"), "/bucket/a/b/c.txt");
      expect(result).toEqual({ key: "a/b/c.txt" });
    });

    it("strips query string before matching", () => {
      const result = protocol.testExtractPathLabels(makeOpSchema("/items/{id}"), "/items/x?v=2");
      expect(result).toEqual({ id: "x" });
    });

    it("returns empty for non-matching path", () => {
      const result = protocol.testExtractPathLabels(makeOpSchema("/items/{id}"), "/other/path");
      expect(result).toEqual({});
    });

    it("returns empty when no http trait", () => {
      const schema = { namespace: "t", name: "Op", traits: {}, input: {}, output: {} } as unknown as $OperationSchema;
      expect(protocol.testExtractPathLabels(schema, "/x")).toEqual({});
    });

    it("caches compiled regex", () => {
      const schema = makeOpSchema("/items/{id}");
      protocol.testExtractPathLabels(schema, "/items/a");
      protocol.testExtractPathLabels(schema, "/items/b");
      expect(protocol["pathRegexCache"].size).toBe(1);
    });
  });

  describe("deserializeRequest - httpHeader", () => {
    it("uses stringDeserializer for header values", async () => {
      let readCalls: Array<{ schema: any; data: string }> = [];
      protocol["stringDeserializer"].read = (schema: any, data: string) => {
        readCalls.push({ schema, data });
        return `parsed:${data}`;
      };

      // Build a minimal mock that structIterator will yield
      const memberSchema = {
        getMergedTraits: () => ({ httpHeader: "x-my-header" }),
        isListSchema: () => false,
      };
      const inputNs = {
        structIterator: function* () {
          yield ["myHeader", memberSchema] as const;
        },
      };

      const { NormalizedSchema } = require("@smithy/core/schema");
      const spy = jest.spyOn(NormalizedSchema, "of").mockReturnValue(inputNs);

      const opSchema = {
        input: {},
        output: {},
        traits: { http: ["GET", "/test", 200] },
        namespace: "test",
        name: "Op",
      } as unknown as $OperationSchema;

      const request = makeRequest({ headers: { "x-my-header": "some-value" }, path: "/test" });
      const result: any = await protocol.deserializeRequest(opSchema, makeContext(), request);

      expect(readCalls.length).toBe(1);
      expect(readCalls[0].data).toBe("some-value");
      expect(result.myHeader).toBe("parsed:some-value");
      spy.mockRestore();
    });
  });

  describe("deserializeRequest - httpQuery", () => {
    it("uses stringDeserializer for scalar query values", async () => {
      let readCalls: string[] = [];
      protocol["stringDeserializer"].read = (_s: any, data: string) => {
        readCalls.push(data);
        return Number(data);
      };

      const memberSchema = {
        getMergedTraits: () => ({ httpQuery: "limit" }),
        isListSchema: () => false,
      };
      const inputNs = {
        structIterator: function* () {
          yield ["limit", memberSchema] as const;
        },
      };

      const { NormalizedSchema } = require("@smithy/core/schema");
      const spy = jest.spyOn(NormalizedSchema, "of").mockReturnValue(inputNs);

      const opSchema = {
        input: {},
        output: {},
        traits: { http: ["GET", "/test", 200] },
        namespace: "test",
        name: "Op2",
      } as unknown as $OperationSchema;

      const request = makeRequest({ query: { limit: "10" }, path: "/test" });
      const result: any = await protocol.deserializeRequest(opSchema, makeContext(), request);

      expect(readCalls).toEqual(["10"]);
      expect(result.limit).toBe(10);
      spy.mockRestore();
    });

    it("deserializes array query params element-by-element for list members", async () => {
      let readCalls: string[] = [];
      const valueSchema = { getMergedTraits: () => ({}) };
      protocol["stringDeserializer"].read = (_s: any, data: string) => {
        readCalls.push(data);
        return Number(data);
      };

      const memberSchema = {
        getMergedTraits: () => ({ httpQuery: "ids" }),
        isListSchema: () => true,
        getValueSchema: () => valueSchema,
      };
      const inputNs = {
        structIterator: function* () {
          yield ["ids", memberSchema] as const;
        },
      };

      const { NormalizedSchema } = require("@smithy/core/schema");
      const spy = jest.spyOn(NormalizedSchema, "of").mockReturnValue(inputNs);

      const opSchema = {
        input: {},
        output: {},
        traits: { http: ["GET", "/test", 200] },
        namespace: "test",
        name: "Op3",
      } as unknown as $OperationSchema;

      const request = makeRequest({ query: { ids: ["1", "2", "3"] }, path: "/test" });
      const result: any = await protocol.deserializeRequest(opSchema, makeContext(), request);

      expect(result.ids).toEqual([1, 2, 3]);
      expect(readCalls).toEqual(["1", "2", "3"]);
      spy.mockRestore();
    });
  });

  describe("deserializeRequest - httpPrefixHeaders", () => {
    it("deserializes each prefix header value through stringDeserializer", async () => {
      let readCalls: string[] = [];
      const valueSchema = { getMergedTraits: () => ({}) };
      protocol["stringDeserializer"].read = (_s: any, data: string) => {
        readCalls.push(data);
        return `parsed:${data}`;
      };

      const memberSchema = {
        getMergedTraits: () => ({ httpPrefixHeaders: "x-meta-" }),
        getValueSchema: () => valueSchema,
      };
      const inputNs = {
        structIterator: function* () {
          yield ["metadata", memberSchema] as const;
        },
      };

      const { NormalizedSchema } = require("@smithy/core/schema");
      const spy = jest.spyOn(NormalizedSchema, "of").mockReturnValue(inputNs);

      const opSchema = {
        input: {},
        output: {},
        traits: { http: ["GET", "/test", 200] },
        namespace: "test",
        name: "Op4",
      } as unknown as $OperationSchema;

      const request = makeRequest({
        headers: { "x-meta-color": "red", "x-meta-size": "large", "authorization": "Bearer tok" },
        path: "/test",
      });
      const result: any = await protocol.deserializeRequest(opSchema, makeContext(), request);

      expect(result.metadata).toEqual({ color: "parsed:red", size: "parsed:large" });
      expect(readCalls).toContain("red");
      expect(readCalls).toContain("large");
      expect(readCalls).not.toContain("Bearer tok");
      spy.mockRestore();
    });
  });

  describe("deserializeRequest - httpPayload", () => {
    it("throws SerializationException for streaming event stream", async () => {
      const memberSchema = {
        getMergedTraits: () => ({ httpPayload: 1 }),
        isStreaming: () => true,
        isStructSchema: () => true,
        isBlobSchema: () => false,
      };
      const inputNs = {
        structIterator: function* () {
          yield ["events", memberSchema] as const;
        },
      };

      const { NormalizedSchema } = require("@smithy/core/schema");
      const spy = jest.spyOn(NormalizedSchema, "of").mockReturnValue(inputNs);

      const opSchema = {
        input: {},
        output: {},
        traits: { http: ["POST", "/test", 200] },
        namespace: "test",
        name: "Op5",
      } as unknown as $OperationSchema;

      const request = makeRequest({ path: "/test", method: "POST" });
      await expect(protocol.deserializeRequest(opSchema, makeContext(), request)).rejects.toBeInstanceOf(
        SerializationException
      );
      spy.mockRestore();
    });

    it("passes streaming blob body through directly", async () => {
      const fakeStream = Symbol("stream");
      const memberSchema = {
        getMergedTraits: () => ({ httpPayload: 1 }),
        isStreaming: () => true,
        isStructSchema: () => false,
        isBlobSchema: () => false,
      };
      const inputNs = {
        structIterator: function* () {
          yield ["body", memberSchema] as const;
        },
      };

      const { NormalizedSchema } = require("@smithy/core/schema");
      const spy = jest.spyOn(NormalizedSchema, "of").mockReturnValue(inputNs);

      const opSchema = {
        input: {},
        output: {},
        traits: { http: ["POST", "/test", 200] },
        namespace: "test",
        name: "Op6",
      } as unknown as $OperationSchema;

      const request = makeRequest({ path: "/test", method: "POST", body: fakeStream } as any);
      const result: any = await protocol.deserializeRequest(opSchema, makeContext(), request);
      expect(result.body).toBe(fakeStream);
      spy.mockRestore();
    });
  });

  describe("serializeSuccess", () => {
    it("sets httpResponseCode from output member", async () => {
      const outputNs = {
        structIterator: function* () {
          yield ["code", { getMergedTraits: () => ({ httpResponseCode: 1 }) }] as const;
        },
      };

      const { NormalizedSchema } = require("@smithy/core/schema");
      const spy = jest.spyOn(NormalizedSchema, "of").mockReturnValue(outputNs);

      const opSchema = { input: {}, output: {}, traits: {} } as unknown as $OperationSchema;
      const response = await (protocol as any).serializeSuccess(opSchema, makeContext(), { code: 201 });
      expect(response.statusCode).toBe(201);
      spy.mockRestore();
    });

    it("lowercases httpHeader names", async () => {
      const outputNs = {
        structIterator: function* () {
          yield ["etag", { getMergedTraits: () => ({ httpHeader: "ETag" }) }] as const;
        },
      };

      const { NormalizedSchema } = require("@smithy/core/schema");
      const spy = jest.spyOn(NormalizedSchema, "of").mockReturnValue(outputNs);

      const opSchema = { input: {}, output: {}, traits: {} } as unknown as $OperationSchema;
      const response = await (protocol as any).serializeSuccess(opSchema, makeContext(), { etag: '"abc"' });
      expect(response.headers["etag"]).toBe('"abc"');
      spy.mockRestore();
    });

    it("throws SerializationException for event stream in response payload", async () => {
      const outputNs = {
        structIterator: function* () {
          yield [
            "events",
            {
              getMergedTraits: () => ({ httpPayload: 1 }),
              isStreaming: () => true,
              isStructSchema: () => true,
              isBlobSchema: () => false,
            },
          ] as const;
        },
      };

      const { NormalizedSchema } = require("@smithy/core/schema");
      const spy = jest.spyOn(NormalizedSchema, "of").mockReturnValue(outputNs);

      const opSchema = { input: {}, output: {}, traits: {} } as unknown as $OperationSchema;
      await expect(
        (protocol as any).serializeSuccess(opSchema, makeContext(), { events: {} })
      ).rejects.toBeInstanceOf(SerializationException);
      spy.mockRestore();
    });

    it("passes streaming blob body through to response", async () => {
      const stream = Symbol("readable");
      const outputNs = {
        structIterator: function* () {
          yield [
            "data",
            {
              getMergedTraits: () => ({ httpPayload: 1 }),
              isStreaming: () => true,
              isStructSchema: () => false,
              isBlobSchema: () => false,
            },
          ] as const;
        },
      };

      const { NormalizedSchema } = require("@smithy/core/schema");
      const spy = jest.spyOn(NormalizedSchema, "of").mockReturnValue(outputNs);

      const opSchema = { input: {}, output: {}, traits: {} } as unknown as $OperationSchema;
      const response = await (protocol as any).serializeSuccess(opSchema, makeContext(), { data: stream });
      expect(response.body).toBe(stream);
      spy.mockRestore();
    });

    it("skips null/undefined output members", async () => {
      const outputNs = {
        structIterator: function* () {
          yield ["etag", { getMergedTraits: () => ({ httpHeader: "ETag" }) }] as const;
          yield ["name", { getMergedTraits: () => ({}) }] as const;
        },
        getSchema: () => ({}),
      };

      const { NormalizedSchema } = require("@smithy/core/schema");
      const spy = jest.spyOn(NormalizedSchema, "of").mockReturnValue(outputNs);

      const opSchema = { input: {}, output: {}, traits: {} } as unknown as $OperationSchema;
      const response = await (protocol as any).serializeSuccess(opSchema, makeContext(), {
        etag: undefined,
        name: undefined,
      });
      expect(response.headers["etag"]).toBeUndefined();
      expect(response.body).toBeUndefined();
      spy.mockRestore();
    });
  });
});
