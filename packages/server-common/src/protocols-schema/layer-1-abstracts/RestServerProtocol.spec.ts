import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as schema from "@smithy/core/schema";
import { NormalizedSchema } from "@smithy/core/schema";
import { RestServerProtocol } from "./RestServerProtocol";
import type {
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  $OperationSchema,
  StaticOperationSchema,
} from "@smithy/types";

vi.mock("@smithy/core/schema", async (importOriginal) => {
  const actual = await importOriginal<typeof schema>();
  return {
    ...actual,
    NormalizedSchema: {
      ...actual.NormalizedSchema,
      of: actual.NormalizedSchema.of,
    },
  };
});

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

  protected async serializeError(): Promise<IHttpResponse> {
    return { statusCode: 500, headers: {} } as any;
  }

  // Expose protected for testing.
  public testExtractPathLabels(schema: StaticOperationSchema, path: string) {
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
    function makeOpSchema(uri: string): StaticOperationSchema {
      return [9, "test", "TestOp", { http: ["GET", uri, 200] }, "unit", "unit"] satisfies StaticOperationSchema;
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
      const schema = [9, "t", "Op", 0, "unit", "unit"] satisfies StaticOperationSchema;
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
          yield ["myHeader", memberSchema];
        },
      };

      const spy = vi.spyOn(NormalizedSchema, "of").mockReturnValue(inputNs as any);

      const opSchema = [
        9,
        "test",
        "Op",
        { http: ["GET", "/test", 200] },
        "unit",
        "unit",
      ] satisfies StaticOperationSchema;

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
          yield ["limit", memberSchema];
        },
      };

      const spy = vi.spyOn(NormalizedSchema, "of").mockReturnValue(inputNs as any);

      const opSchema = [
        9,
        "test",
        "Op2",
        { http: ["GET", "/test", 200] },
        "unit",
        "unit",
      ] satisfies StaticOperationSchema;

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
          yield ["ids", memberSchema];
        },
      };

      const spy = vi.spyOn(NormalizedSchema, "of").mockReturnValue(inputNs as any);

      const opSchema = [
        9,
        "test",
        "Op3",
        { http: ["GET", "/test", 200] },
        "unit",
        "unit",
      ] satisfies StaticOperationSchema;

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
          yield ["metadata", memberSchema];
        },
      };

      const spy = vi.spyOn(NormalizedSchema, "of").mockReturnValue(inputNs as any);

      const opSchema = [
        9,
        "test",
        "Op4",
        { http: ["GET", "/test", 200] },
        "unit",
        "unit",
      ] satisfies StaticOperationSchema;

      const request = makeRequest({
        headers: { "x-meta-color": "red", "x-meta-size": "large", authorization: "Bearer tok" },
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
    it("deserializes streaming event stream via event stream serde", async () => {
      // A streaming union with @httpPayload — the input struct has one member
      // "events" targeting a union schema with { streaming: 1 }, and the member
      // itself carries { httpPayload: 1 }.
      const streamingUnion: any = [4, "test", "Events", { streaming: 1 }, ["a"], [0]];
      const inputSchema: any = [3, "test", "Input", 0, ["events"], [[() => streamingUnion, { httpPayload: 1 }]]];

      const opSchema = [
        9,
        "test",
        "Op5",
        { http: ["POST", "/test", 200] },
        () => inputSchema,
        "unit",
      ] satisfies StaticOperationSchema;

      // Provide an empty async iterable as the body (simulates binary event stream).
      const fakeBody = (async function* () {})();
      const request = makeRequest({ path: "/test", method: "POST", body: fakeBody } as any);
      const result: any = await protocol.deserializeRequest(opSchema, makeContext(), request);
      // The event stream member is populated with an async iterable.
      expect(result.events).toBeDefined();
      expect(result.events[Symbol.asyncIterator]).toBeDefined();
    });

    it("passes streaming blob body through directly", async () => {
      const fakeStream = Symbol("stream");
      // 42 is StreamingBlobSchema sentinel. Member has { httpPayload: 1 }.
      const inputSchema: any = [3, "test", "Input", 0, ["body"], [[42, { httpPayload: 1 }]]];

      const opSchema = [
        9,
        "test",
        "Op6",
        { http: ["POST", "/test", 200] },
        () => inputSchema,
        "unit",
      ] satisfies StaticOperationSchema;

      const request = makeRequest({ path: "/test", method: "POST", body: fakeStream } as any);
      const result: any = await protocol.deserializeRequest(opSchema, makeContext(), request);
      expect(result.body).toBe(fakeStream);
    });
  });

  describe("serializeSuccess", () => {
    it("sets httpResponseCode from output member", async () => {
      const outputNs = {
        structIterator: function* () {
          yield ["code", { getMergedTraits: () => ({ httpResponseCode: 1 }) }];
        },
      };

      const spy = vi.spyOn(NormalizedSchema, "of").mockReturnValue(outputNs as any);

      const opSchema = { input: {}, output: {}, traits: {} } as unknown as $OperationSchema;
      const response = await (protocol as any).serializeSuccess(opSchema, makeContext(), { code: 201 });
      expect(response.statusCode).toBe(201);
      spy.mockRestore();
    });

    it("lowercases httpHeader names", async () => {
      const outputNs = {
        structIterator: function* () {
          yield ["etag", { getMergedTraits: () => ({ httpHeader: "ETag" }) }];
        },
      };

      const spy = vi.spyOn(NormalizedSchema, "of").mockReturnValue(outputNs as any);

      const opSchema = { input: {}, output: {}, traits: {} } as unknown as $OperationSchema;
      const response = await (protocol as any).serializeSuccess(opSchema, makeContext(), { etag: '"abc"' });
      expect(response.headers["etag"]).toBe('"abc"');
      spy.mockRestore();
    });

    it("serializes event stream in response payload as binary stream", async () => {
      // A streaming union with @httpPayload — the output struct has one member
      // "events" targeting a union schema with { streaming: 1 }, and the member
      // itself carries { httpPayload: 1 }.
      const streamingUnion: any = [4, "test", "Events", { streaming: 1 }, ["a"], [0]];
      const outputSchema: any = [3, "test", "Output", 0, ["events"], [[() => streamingUnion, { httpPayload: 1 }]]];

      const opSchema = [
        9,
        "test",
        "Op",
        { http: ["POST", "/test", 200] },
        "unit",
        () => outputSchema,
      ] satisfies StaticOperationSchema;

      const fakeEvents = (async function* () {})();
      const response = await (protocol as any).serializeSuccess(opSchema, makeContext(), { events: fakeEvents });
      // The response should have event stream content type.
      expect(response.headers["content-type"]).toBe("application/vnd.amazon.eventstream");
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
          ];
        },
      };

      const spy = vi.spyOn(NormalizedSchema, "of").mockReturnValue(outputNs as any);

      const opSchema = { input: {}, output: {}, traits: {} } as unknown as $OperationSchema;
      const response = await (protocol as any).serializeSuccess(opSchema, makeContext(), { data: stream });
      expect(response.body).toBe(stream);
      spy.mockRestore();
    });

    it("skips null/undefined output members", async () => {
      const outputNs = {
        structIterator: function* () {
          yield ["etag", { getMergedTraits: () => ({ httpHeader: "ETag" }) }];
          yield ["name", { getMergedTraits: () => ({}) }];
        },
        getSchema: () => ({}),
      };

      const spy = vi.spyOn(NormalizedSchema, "of").mockReturnValue(outputNs as any);

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
