import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { XYZServiceHandler } from "xyz-schema-server";
import {
  XYZServiceClient,
  GetNumbersCommand,
  CamelCaseOperationCommand,
  HttpLabelCommandCommand,
  ValidatedOperationCommand,
} from "xyz-schema";
import {
  SmithyRpcV2CborServerProtocol,
  AwsRestJsonServerProtocol,
  AwsJsonRpcServerProtocol,
  SchemaServiceHandler,
} from "../src/index";
import { HttpRequest } from "@smithy/core/protocols";
import { AwsRestJsonProtocol, AwsJson1_0Protocol } from "@aws-sdk/core/protocols";
import { GetNumbers$, camelCaseOperation$ } from "xyz-schema-server";
import { convertRequest, writeResponse } from "@smithy/server-node";

/**
 * End-to-end integration test that stands up a real Node.js HTTP server
 * backed by the schema-based server handler with BOTH SmithyRpcV2Cbor and
 * AwsRestJson1 protocols registered. The server routes requests to the
 * appropriate protocol based on headers.
 *
 * Two clients are created: one using the default CBOR protocol and one
 * overridden to use restJson1. Both hit the same server.
 */
describe("Multi-protocol schema SSDK over HTTP", () => {
  let server: http.Server;
  let cborClient: XYZServiceClient;
  let jsonClient: XYZServiceClient;
  let jsonRpcClient: XYZServiceClient;
  let baseUrl: string;

  const handler = new XYZServiceHandler({
    protocols: [
      new SmithyRpcV2CborServerProtocol({ defaultNamespace: "org.xyz.v1" }),
      new AwsRestJsonServerProtocol({ defaultNamespace: "org.xyz.v1" }),
      new AwsJsonRpcServerProtocol({ defaultNamespace: "org.xyz.v1" }),
    ],
    // logger: console,
    handlers: {
      async GetNumbers(input) {
        const inputNumbers = input.numbers ?? {};
        const doubled = Object.values(inputNumbers).map((n) => n * 2);
        return {
          numbers: doubled,
          nextToken: input.startToken ? `next-${input.startToken}` : undefined,
          bigInteger: input.bigInteger ? input.bigInteger * BigInt(2) : undefined,
        };
      },
      async camelCaseOperation(input) {
        const reversed = input.token ? input.token.split("").reverse().join("") : "empty";
        return {
          token: reversed,
          results: [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])],
        };
      },
      async HttpLabelCommand(_input) {
        return {};
      },
      async HostPrefixOperation(_input) {
        return {};
      },
      async TradeEventStream(_input) {
        return {} as any;
      },
      async ValidatedOperation(input) {
        return {
          message: `Hello, ${input.username}! You are ${input.age} years old.`,
        };
      },
    },
  });

  beforeAll(async () => {
    server = http.createServer(async (req, res) => {
      const httpRequest = convertRequest(req);
      const httpResponse = await handler.handle(httpRequest, {});
      writeResponse(httpResponse, res);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const addr = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;

    // CBOR client — uses default protocol.
    cborClient = new XYZServiceClient({
      endpoint: baseUrl,
      apiKey: { apiKey: "test-key" },
    });

    // restJson1 client — overrides protocol.
    jsonClient = new XYZServiceClient({
      endpoint: baseUrl,
      apiKey: { apiKey: "test-key" },
      protocol: AwsRestJsonProtocol,
      protocolSettings: {
        defaultNamespace: "org.xyz.v1",
      },
    });

    // AWS JSON 1.0 RPC client — overrides protocol.
    jsonRpcClient = new XYZServiceClient({
      endpoint: baseUrl,
      apiKey: { apiKey: "test-key" },
      protocol: AwsJson1_0Protocol,
      protocolSettings: {
        defaultNamespace: "org.xyz.v1",
        serviceTarget: "XYZService",
      },
    });
  });

  afterAll(async () => {
    cborClient.destroy();
    jsonClient.destroy();
    jsonRpcClient.destroy();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  describe("CBOR protocol (smithy.protocols#rpcv2Cbor)", () => {
    it("GetNumbers: doubles input numbers", async () => {
      const response = await cborClient.send(
        new GetNumbersCommand({
          numbers: { a: 5, b: 10, c: 25 },
          startToken: "page1",
        })
      );
      expect(response.numbers).toEqual([10, 20, 50]);
      expect(response.nextToken).toBe("next-page1");
    });

    it("GetNumbers: handles bigInteger round-trip", async () => {
      const response = await cborClient.send(
        new GetNumbersCommand({
          bigInteger: BigInt("9007199254740993"),
        })
      );
      expect(response.bigInteger).toBe(BigInt("18014398509481986"));
    });

    it("camelCaseOperation: reverses the token", async () => {
      const response = await cborClient.send(new CamelCaseOperationCommand({ token: "smithy" }));
      expect(response.token).toBe("yhtims");
      expect(response.results).toHaveLength(2);
    });

    it("HttpLabelCommand: round-trips successfully", async () => {
      const response = await cborClient.send(
        new HttpLabelCommandCommand({ LabelDoesNotApplyToRpcProtocol: "my-label-value" })
      );
      expect(response).toBeDefined();
    });

    it("unknown operation returns an error", async () => {
      const response = await new Promise<{ statusCode: number }>((resolve, reject) => {
        const req = http.request(
          `${baseUrl}/service/org.xyz.v1%23XYZService/operation/NonExistent`,
          {
            method: "POST",
            headers: {
              "content-type": "application/cbor",
              "smithy-protocol": "rpc-v2-cbor",
            },
          },
          (res) => {
            res.resume();
            res.on("end", () => resolve({ statusCode: res.statusCode! }));
          }
        );
        req.on("error", reject);
        req.end();
      });
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe("restJson1 protocol (aws.protocols#restJson1)", () => {
    it("GetNumbers: doubles input numbers", async () => {
      const response = await jsonClient.send(
        new GetNumbersCommand({
          numbers: { a: 3, b: 7 },
          startToken: "tok",
        })
      );
      expect(response.numbers).toEqual([6, 14]);
      expect(response.nextToken).toBe("next-tok");
    });

    it("GetNumbers: returns empty list when no input", async () => {
      const response = await jsonClient.send(new GetNumbersCommand({}));
      expect(response.numbers).toEqual([]);
      expect(response.nextToken).toBeUndefined();
    });

    it("camelCaseOperation: reverses the token", async () => {
      const response = await jsonClient.send(new CamelCaseOperationCommand({ token: "hello" }));
      expect(response.token).toBe("olleh");
    });

    it("camelCaseOperation: returns 'empty' when no token", async () => {
      const response = await jsonClient.send(new CamelCaseOperationCommand({}));
      expect(response.token).toBe("empty");
    });

    it("HttpLabelCommand: round-trips successfully", async () => {
      const response = await jsonClient.send(
        new HttpLabelCommandCommand({ LabelDoesNotApplyToRpcProtocol: "json-label" })
      );
      expect(response).toBeDefined();
    });
  });

  describe("awsJson1_0 protocol (aws.protocols#awsJson1_0)", () => {
    it("GetNumbers: doubles input numbers", async () => {
      const response = await jsonRpcClient.send(
        new GetNumbersCommand({
          numbers: { x: 4, y: 8 },
          startToken: "rpc-tok",
        })
      );
      expect(response.numbers).toEqual([8, 16]);
      expect(response.nextToken).toBe("next-rpc-tok");
    });

    it("GetNumbers: returns empty list when no input", async () => {
      const response = await jsonRpcClient.send(new GetNumbersCommand({}));
      expect(response.numbers).toEqual([]);
      expect(response.nextToken).toBeUndefined();
    });

    it("camelCaseOperation: reverses the token", async () => {
      const response = await jsonRpcClient.send(new CamelCaseOperationCommand({ token: "rpc" }));
      expect(response.token).toBe("cpr");
    });

    it("camelCaseOperation: returns 'empty' when no token", async () => {
      const response = await jsonRpcClient.send(new CamelCaseOperationCommand({}));
      expect(response.token).toBe("empty");
    });

    it("ValidatedOperation: accepts valid input", async () => {
      const response = await jsonRpcClient.send(
        new ValidatedOperationCommand({
          username: "charlie",
          age: 40,
          email: "charlie@test.com",
          tags: ["ops"],
          address: { zipCode: "55555", state: "MN" },
        })
      );
      expect(response.message).toBe("Hello, charlie! You are 40 years old.");
    });

    it("ValidatedOperation: server rejects invalid input", async () => {
      await expect(
        jsonRpcClient.send(
          new ValidatedOperationCommand({
            username: "",
            age: 0,
            email: "bad",
            tags: [],
          })
        )
      ).rejects.toThrow();
    });
  });

  describe("protocol routing", () => {
    it("same server handles CBOR, restJson1, and awsJson1_0 requests concurrently", async () => {
      const [cborResult, jsonResult, rpcResult] = await Promise.all([
        cborClient.send(new CamelCaseOperationCommand({ token: "cbor" })),
        jsonClient.send(new CamelCaseOperationCommand({ token: "json" })),
        jsonRpcClient.send(new CamelCaseOperationCommand({ token: "rpc1" })),
      ]);
      expect(cborResult.token).toBe("robc");
      expect(jsonResult.token).toBe("nosj");
      expect(rpcResult.token).toBe("1cpr");
    });
  });

  describe("constraint validation (shared across protocols)", () => {
    it("CBOR client: server validates input constraints", async () => {
      const response = await cborClient.send(
        new ValidatedOperationCommand({
          username: "alice",
          age: 30,
          email: "alice@example.com",
          tags: ["admin"],
          address: { zipCode: "12345", state: "WA" },
        })
      );
      expect(response.message).toBe("Hello, alice! You are 30 years old.");
    });

    it("JSON client: server validates input constraints", async () => {
      const response = await jsonClient.send(
        new ValidatedOperationCommand({
          username: "bob",
          age: 25,
          email: "bob@test.com",
          tags: ["user"],
          address: { zipCode: "98101", state: "WA" },
        })
      );
      expect(response.message).toBe("Hello, bob! You are 25 years old.");
    });

    it("CBOR client: server rejects invalid input", async () => {
      await expect(
        cborClient.send(
          new ValidatedOperationCommand({
            username: "",
            age: 0,
            email: "invalid",
            tags: [],
          })
        )
      ).rejects.toThrow();
    });

    it("JSON client: server rejects invalid input", async () => {
      await expect(
        jsonClient.send(
          new ValidatedOperationCommand({
            username: "",
            age: 0,
            email: "invalid",
            tags: [],
          })
        )
      ).rejects.toThrow();
    });
  });

  describe("interceptor modify hooks", () => {
    let interceptorServer: http.Server;
    let interceptorClient: XYZServiceClient;
    let interceptorBaseUrl: string;
    const hooksCalled: string[] = [];

    beforeAll(async () => {
      const interceptorHandler = new XYZServiceHandler({
        protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "org.xyz.v1" })],
        handlers: {
          async GetNumbers(input) {
            return {
              numbers: Object.values(input.numbers ?? {}).map((n: number) => n * 2),
            };
          },
          async camelCaseOperation(input) {
            return { token: input.token ?? "empty" };
          },
          async HttpLabelCommand() {
            return {};
          },
          async HostPrefixOperation() {
            return {};
          },
          async TradeEventStream() {
            return {} as any;
          },
          async ValidatedOperation(input) {
            return { message: `Hello, ${input.username}!` };
          },
        },
      });

      interceptorHandler.addInterceptor({
        modifyBeforeDeserialization(hook) {
          hooksCalled.push("modifyBeforeDeserialization");
          return hook.request; // pass through unchanged
        },
        modifyBeforeValidation(hook) {
          hooksCalled.push("modifyBeforeValidation");
          // Inject a modified token to prove the hook runs before the handler
          if (hook.operation === "camelCaseOperation" && (hook.input as any).token === "intercept-me") {
            return { ...(hook.input as any), token: "intercepted" };
          }
          return hook.input;
        },
        modifyBeforeSerialization(hook) {
          hooksCalled.push("modifyBeforeSerialization");
          // Append a suffix to prove the hook modifies output before serialization
          if (hook.operation === "camelCaseOperation") {
            return { ...(hook.output as any), token: (hook.output as any).token + "-modified" };
          }
          return hook.output;
        },
        modifyBeforeCompletion(hook) {
          hooksCalled.push("modifyBeforeCompletion");
          // Add a custom header to prove the hook can modify the response
          hook.response.headers["x-intercepted"] = "true";
          return hook.response;
        },
      });

      interceptorServer = http.createServer(async (req, res) => {
        const httpRequest = convertRequest(req);
        const httpResponse = await interceptorHandler.handle(httpRequest, {});
        writeResponse(httpResponse, res);
      });

      await new Promise<void>((resolve) => {
        interceptorServer.listen(0, "127.0.0.1", () => resolve());
      });

      const addr = interceptorServer.address() as { port: number };
      interceptorBaseUrl = `http://127.0.0.1:${addr.port}`;

      interceptorClient = new XYZServiceClient({
        endpoint: interceptorBaseUrl,
        apiKey: { apiKey: "test-key" },
      });
    });

    afterAll(async () => {
      interceptorClient.destroy();
      await new Promise<void>((resolve, reject) => {
        interceptorServer.close((err) => (err ? reject(err) : resolve()));
      });
    });

    it("modifyBeforeValidation can replace handler input", async () => {
      hooksCalled.length = 0;
      const response = await interceptorClient.send(new CamelCaseOperationCommand({ token: "intercept-me" }));
      // The interceptor replaces "intercept-me" with "intercepted" before the handler runs,
      // then modifyBeforeSerialization appends "-modified".
      expect(response.token).toBe("intercepted-modified");
    });

    it("modifyBeforeSerialization can modify handler output", async () => {
      hooksCalled.length = 0;
      const response = await interceptorClient.send(new CamelCaseOperationCommand({ token: "hello" }));
      // Handler returns "hello", modifyBeforeSerialization appends "-modified".
      expect(response.token).toBe("hello-modified");
    });

    it("all four modify hooks are called in order", async () => {
      hooksCalled.length = 0;
      await interceptorClient.send(new CamelCaseOperationCommand({ token: "test" }));
      expect(hooksCalled).toEqual([
        "modifyBeforeDeserialization",
        "modifyBeforeValidation",
        "modifyBeforeSerialization",
        "modifyBeforeCompletion",
      ]);
    });
  });

  describe("direct SchemaServiceHandler instantiation (no subclass)", () => {
    let directServer: http.Server;
    let directClient: XYZServiceClient;
    let directBaseUrl: string;

    beforeAll(async () => {
      const directHandler = new SchemaServiceHandler({
        protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "org.xyz.v1" })],
        operationSchemas: [GetNumbers$, camelCaseOperation$],
        handlers: {
          GetNumbers: async (input: any) => {
            const inputNumbers = input.numbers ?? {};
            const tripled = Object.values(inputNumbers).map((n: any) => n * 3);
            return { numbers: tripled };
          },
          camelCaseOperation: async (input: any) => {
            return { token: `direct-${input.token ?? "none"}` };
          },
        },
      });

      directServer = http.createServer(async (req, res) => {
        const httpRequest = convertRequest(req);
        const httpResponse = await directHandler.handle(httpRequest, {});
        writeResponse(httpResponse, res);
      });

      await new Promise<void>((resolve) => {
        directServer.listen(0, "127.0.0.1", () => resolve());
      });

      const addr = directServer.address() as { port: number };
      directBaseUrl = `http://127.0.0.1:${addr.port}`;

      directClient = new XYZServiceClient({
        endpoint: directBaseUrl,
        apiKey: { apiKey: "test-key" },
      });
    });

    afterAll(async () => {
      directClient.destroy();
      await new Promise<void>((resolve, reject) => {
        directServer.close((err) => (err ? reject(err) : resolve()));
      });
    });

    it("GetNumbers: triples input numbers", async () => {
      const response = await directClient.send(new GetNumbersCommand({ numbers: { a: 2, b: 5 } }));
      expect(response.numbers).toEqual([6, 15]);
    });

    it("camelCaseOperation: prefixes token with 'direct-'", async () => {
      const response = await directClient.send(new CamelCaseOperationCommand({ token: "hello" }));
      expect(response.token).toBe("direct-hello");
    });

    it("returns error for operations not in the subset", async () => {
      // ValidatedOperation is not registered on this handler
      await expect(
        directClient.send(
          new ValidatedOperationCommand({
            username: "alice",
            age: 30,
            email: "a@b.com",
            tags: ["x"],
            address: { zipCode: "12345", state: "WA" },
          })
        )
      ).rejects.toThrow();
    });

    it("dynamically adds an operation via addOperation", async () => {
      const dynamicHandler = new SchemaServiceHandler({
        protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "org.xyz.v1" })],
        operationSchemas: [GetNumbers$],
        handlers: {
          GetNumbers: async () => ({ numbers: [99] }),
        },
      });

      // Dynamically add camelCaseOperation
      dynamicHandler.addOperation(camelCaseOperation$, async (input: any) => ({
        token: `added-${input.token ?? ""}`,
      }));

      const request = new HttpRequest({
        method: "POST",
        path: `/service/org.xyz.v1%23XYZService/operation/camelCaseOperation`,
        headers: {
          "content-type": "application/cbor",
          "smithy-protocol": "rpc-v2-cbor",
          accept: "application/cbor",
        },
        body: new Uint8Array(0),
      });

      const response = await dynamicHandler.handle(request, {});
      expect(response.statusCode).toBeLessThan(400);
    });
  });
});
