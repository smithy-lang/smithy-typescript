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
import { SmithyRpcV2CborServerProtocol } from "../src/index";
import type { HttpResponse } from "@smithy/core/protocols";
import { HttpRequest } from "@smithy/core/protocols";

/**
 * End-to-end integration test that stands up a real Node.js HTTP server
 * backed by the schema-based server handler, then exercises it using
 * the generated client SDK over the network.
 */
describe("Schema-based SSDK over HTTP", () => {
  let server: http.Server;
  let client: XYZServiceClient;
  let baseUrl: string;

  const handler = new XYZServiceHandler({
    protocols: [new SmithyRpcV2CborServerProtocol({ defaultNamespace: "org.xyz.v1" })],
    handlers: {
      async GetNumbers(input) {
        // Business logic: multiply each value in the input map by 2 and return as list
        const inputNumbers = input.numbers ?? {};
        const doubled = Object.values(inputNumbers).map((n) => n * 2);
        return {
          numbers: doubled,
          nextToken: input.startToken ? `next-${input.startToken}` : undefined,
          bigInteger: input.bigInteger ? input.bigInteger * BigInt(2) : undefined,
        };
      },
      async camelCaseOperation(input) {
        // Business logic: reverse the token string
        const reversed = input.token ? input.token.split("").reverse().join("") : "empty";
        return {
          token: reversed,
          results: [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])],
        };
      },
      async HttpLabelCommand(input) {
        // Just confirms we received and processed the input
        return {};
      },
      async HostPrefixOperation(_input) {
        return {};
      },
      async TradeEventStream(_input) {
        return {} as any;
      },
      async ValidatedOperation(input) {
        // Business logic: echo back a confirmation with the username
        return {
          message: `Hello, ${input.username}! You are ${input.age} years old.`,
        };
      },
    },
  });

  beforeAll(async () => {
    server = http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);

      const httpRequest = new HttpRequest({
        method: req.method ?? "POST",
        path: req.url ?? "/",
        headers: Object.fromEntries(
          Object.entries(req.headers)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v!])
        ),
        body,
      });

      let httpResponse: HttpResponse;
      try {
        httpResponse = await handler.handle(httpRequest, {});
      } catch (ignored: unknown) {
        res.writeHead(500);
        res.end();
        return;
      }

      res.writeHead(httpResponse.statusCode, httpResponse.headers);
      if (httpResponse.body) {
        res.end(httpResponse.body);
      } else {
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const addr = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;

    client = new XYZServiceClient({
      endpoint: baseUrl,
      apiKey: { apiKey: "test-key" },
    });
  });

  afterAll(async () => {
    client.destroy();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("GetNumbers: server doubles input numbers and returns them as a list", async () => {
    const response = await client.send(
      new GetNumbersCommand({
        numbers: { a: 5, b: 10, c: 25 },
        startToken: "page1",
      })
    );

    expect(response.numbers).toEqual([10, 20, 50]);
    expect(response.nextToken).toBe("next-page1");
  });

  it("GetNumbers: handles bigInteger round-trip", async () => {
    const response = await client.send(
      new GetNumbersCommand({
        bigInteger: BigInt("9007199254740993"), // larger than Number.MAX_SAFE_INTEGER
      })
    );

    expect(response.bigInteger).toBe(BigInt("18014398509481986"));
  });

  it("GetNumbers: returns empty list when no input numbers provided", async () => {
    const response = await client.send(new GetNumbersCommand({}));

    expect(response.numbers).toEqual([]);
    expect(response.nextToken).toBeUndefined();
  });

  it("camelCaseOperation: server reverses the token", async () => {
    const response = await client.send(new CamelCaseOperationCommand({ token: "smithy" }));

    expect(response.token).toBe("yhtims");
    expect(response.results).toHaveLength(2);
    expect(new Uint8Array(response.results![0])).toEqual(new Uint8Array([1, 2, 3]));
    expect(new Uint8Array(response.results![1])).toEqual(new Uint8Array([4, 5, 6]));
  });

  it("camelCaseOperation: returns 'empty' when no token provided", async () => {
    const response = await client.send(new CamelCaseOperationCommand({}));

    expect(response.token).toBe("empty");
  });

  it("HttpLabelCommand: processes request with required label input", async () => {
    const response = await client.send(
      new HttpLabelCommandCommand({ LabelDoesNotApplyToRpcProtocol: "my-label-value" })
    );

    // Server returns empty output — success means the round-trip worked
    expect(response).toBeDefined();
  });

  it("unknown operation returns an error", async () => {
    // Manually send a request to an unknown operation path
    const response = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
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
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () =>
            resolve({
              statusCode: res.statusCode!,
              body: Buffer.concat(chunks).toString(),
            })
          );
        }
      );
      req.on("error", reject);
      req.end();
    });

    // Should get an error response (UnknownOperationException)
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });

  describe("constraint validation", () => {
    it("server accepts valid input that satisfies all constraints", async () => {
      const response = await client.send(
        new ValidatedOperationCommand({
          username: "alice",
          age: 30,
          email: "alice@example.com",
          tags: ["admin", "user"],
          uniqueTags: ["tag1", "tag2", "tag3"],
          address: {
            zipCode: "12345",
            state: "WA",
          },
        })
      );

      // Business logic executed successfully
      expect(response.message).toBe("Hello, alice! You are 30 years old.");
    });

    it("server rejects username that violates @length(min: 1, max: 100)", async () => {
      await expect(
        client.send(
          new ValidatedOperationCommand({
            username: "", // too short, min is 1
            age: 25,
            email: "bob@test.com",
            tags: ["user"],
          })
        )
      ).rejects.toThrow();
    });

    it("server rejects username exceeding max length", async () => {
      await expect(
        client.send(
          new ValidatedOperationCommand({
            username: "x".repeat(101), // exceeds max: 100
            age: 25,
            email: "bob@test.com",
            tags: ["user"],
          })
        )
      ).rejects.toThrow();
    });

    it("server rejects age that violates @range(min: 1, max: 150)", async () => {
      await expect(
        client.send(
          new ValidatedOperationCommand({
            username: "bob",
            age: 0, // below min: 1
            email: "bob@test.com",
            tags: ["user"],
          })
        )
      ).rejects.toThrow();
    });

    it("server rejects age exceeding max range", async () => {
      await expect(
        client.send(
          new ValidatedOperationCommand({
            username: "bob",
            age: 200, // exceeds max: 150
            email: "bob@test.com",
            tags: ["user"],
          })
        )
      ).rejects.toThrow();
    });

    it("server rejects email that violates @pattern", async () => {
      await expect(
        client.send(
          new ValidatedOperationCommand({
            username: "bob",
            age: 25,
            email: "not-an-email", // doesn't match email pattern
            tags: ["user"],
          })
        )
      ).rejects.toThrow();
    });

    it("server rejects tags list that violates @length(min: 1, max: 5)", async () => {
      await expect(
        client.send(
          new ValidatedOperationCommand({
            username: "bob",
            age: 25,
            email: "bob@test.com",
            tags: ["a", "b", "c", "d", "e", "f"], // exceeds max: 5
          })
        )
      ).rejects.toThrow();
    });

    it("server rejects uniqueTags with duplicate items (@uniqueItems)", async () => {
      await expect(
        client.send(
          new ValidatedOperationCommand({
            username: "bob",
            age: 25,
            email: "bob@test.com",
            tags: ["user"],
            uniqueTags: ["same", "same"], // duplicate violates uniqueItems
          })
        )
      ).rejects.toThrow();
    });

    it("server rejects zipCode that violates nested @pattern", async () => {
      await expect(
        client.send(
          new ValidatedOperationCommand({
            username: "bob",
            age: 25,
            email: "bob@test.com",
            tags: ["user"],
            address: {
              zipCode: "ABC", // doesn't match ^[0-9]{5}$
              state: "WA",
            },
          })
        )
      ).rejects.toThrow();
    });

    it("server rejects state that violates nested @length(min: 2, max: 2)", async () => {
      await expect(
        client.send(
          new ValidatedOperationCommand({
            username: "bob",
            age: 25,
            email: "bob@test.com",
            tags: ["user"],
            address: {
              zipCode: "98101",
              state: "Washington", // exceeds max: 2
            },
          })
        )
      ).rejects.toThrow();
    });

    it("client sends invalid data without throwing - proves client does NOT validate constraints", async () => {
      // The client SDK should serialize and send the request even with invalid data.
      // The SERVER is the one that rejects it.
      // We prove the client doesn't validate by catching the server's rejection
      // and inspecting the error — it must come from the server (ValidationException),
      // not from a local client-side validation.
      try {
        await client.send(
          new ValidatedOperationCommand({
            username: "", // violates server-side @length(min: 1)
            age: -5, // violates server-side @range(min: 1)
            email: "invalid", // violates server-side @pattern
            tags: [], // violates server-side @length(min: 1)
            uniqueTags: ["dup", "dup"], // violates server-side @uniqueItems
            address: {
              zipCode: "bad",
              state: "TOOLONG",
            },
          })
        );
        // If we get here, neither client nor server rejected (unexpected).
        expect.fail("Expected the server to reject the request");
      } catch (err: any) {
        // The error should be a service exception from the server, not a local client error.
        // This proves the client serialized and sent the invalid data over the wire
        // and the server was the one that rejected it.
        expect(err.name).toBe("ValidationException");
        expect(err.$fault).toBe("client");
        // The message should contain multiple validation errors from the server
        expect(err.message).toContain("length");
        expect(err.message).toContain("less than minimum");
        expect(err.message).toContain("pattern");
        expect(err.message).toContain("uniqueItems");
      }
    });
  });
});
