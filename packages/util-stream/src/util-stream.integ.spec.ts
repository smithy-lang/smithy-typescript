import { HttpHandler, HttpResponse } from "@smithy/protocol-http";
import { HttpRequest as IHttpRequest } from "@smithy/types";
import { Uint8ArrayBlobAdapter } from "@smithy/util-stream";
import { requireRequestsFrom } from "@smithy/util-test";
import { fromUtf8 } from "@smithy/util-utf8";
import { Readable } from "stream";
import { Weather } from "weather";

describe("util-stream", () => {
  describe(Weather.name, () => {
    it("should be uniform between string and Uint8Array payloads", async () => {
      const client = new Weather({ endpoint: "https://foo.bar" });
      requireRequestsFrom(client).toMatch({
        method: "POST",
        hostname: "foo.bar",
        query: {},
        headers: {
          "content-type": "application/octet-stream",
          "content-length": "17",
        },
        body(raw) {
          expect(raw.toString("utf-8")).toEqual('{"hello":"world"}');
        },
        protocol: "https:",
        path: "/invoke",
      });

      // string
      await client.invoke({
        payload: JSON.stringify({
          hello: "world",
        }),
      });

      // Uint8Array
      await client.invoke({
        payload: Buffer.from(
          JSON.stringify({
            hello: "world",
          })
        ),
      });
    });
  });

  describe("blob helper integration", () => {
    const client = new Weather({ endpoint: "https://foo.bar" });

    requireRequestsFrom(client).toMatch({
      method: "POST",
      hostname: "foo.bar",
      query: {},
      headers: {
        "content-type": "application/octet-stream",
      },
      protocol: "https:",
      path: "/invoke",
    });

    client.config.requestHandler = new (class implements HttpHandler {
      async handle(request: IHttpRequest) {
        return {
          response: new HttpResponse({
            statusCode: 200,
            body: typeof request.body === "string" ? fromUtf8(request.body) : Uint8Array.from(request.body),
          }),
        };
      }
      updateHttpClientConfig() {}
      httpHandlerConfigs(): Record<string, any> {
        return {};
      }
    })();

    it("should allow string as payload blob and allow conversion of output payload blob to string", async () => {
      const payload = JSON.stringify({ hello: "world" });
      const invoke = await client.invoke({ payload: payload });
      expect(JSON.parse(invoke?.payload?.transformToString() ?? "{}")).toEqual({ hello: "world" });
    });

    it("should allow Uint8Array as payload blob", async () => {
      const payload = Uint8ArrayBlobAdapter.fromString(JSON.stringify({ hello: "world" }));
      const invoke = await client.invoke({ payload: payload });
      expect(JSON.parse(invoke?.payload?.transformToString() ?? "{}")).toEqual({ hello: "world" });
    });

    it("should allow buffer as payload blob", async () => {
      // note: Buffer extends Uint8Array
      const payload = Buffer.from(Uint8ArrayBlobAdapter.fromString(JSON.stringify({ hello: "world" })));
      const invoke = await client.invoke({ payload: payload });
      expect(JSON.parse(invoke?.payload?.transformToString() ?? "{}")).toEqual({ hello: "world" });
    });

    it("should allow stream as payload blob but not be able to sign it", async () => {
      const payload = Readable.from(Buffer.from(Uint8ArrayBlobAdapter.fromString(JSON.stringify({ hello: "world" }))), {
        encoding: "utf-8",
      });
      expect(JSON.parse(await streamToString(payload))).toEqual({ hello: "world" });
      await client.invoke({ payload: payload }).catch((e) => {
        expect(e.toString()).toContain("InvalidSignatureException");
      });
      expect.hasAssertions();
    });
  });

  function streamToString(stream: Readable): Promise<string> {
    const chunks: any[] = [];
    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("error", (err) => reject(err));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  }
});
