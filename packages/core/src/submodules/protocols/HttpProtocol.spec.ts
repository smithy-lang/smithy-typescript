import { map, NormalizedSchema, SCHEMA, struct } from "@smithy/core/schema";
import { HttpResponse } from "@smithy/protocol-http";
import type { HandlerExecutionContext, HttpResponse as IHttpResponse, Schema, SerdeFunctions } from "@smithy/types";
import { toUtf8 } from "@smithy/util-utf8";
import { Readable } from "node:stream";
import { describe, expect, test as it, vi } from "vitest";

import { HttpProtocol } from "./HttpProtocol";
import { FromStringShapeDeserializer } from "./serde/FromStringShapeDeserializer";
import { ToStringShapeSerializer } from "./serde/ToStringShapeSerializer";

describe(HttpProtocol.name, () => {
  it("ignores http bindings (only HttpBindingProtocol uses them)", async () => {
    type TestSignature = (
      schema: Schema,
      context: HandlerExecutionContext & SerdeFunctions,
      response: IHttpResponse,
      dataObject: any
    ) => Promise<string[]>;
    const deserializeHttpMessage = ((HttpProtocol.prototype as any).deserializeHttpMessage as TestSignature).bind({
      deserializer: new FromStringShapeDeserializer({
        httpBindings: true,
        timestampFormat: {
          useTrait: true,
          default: SCHEMA.TIMESTAMP_EPOCH_SECONDS,
        },
      }),
    });
    const httpResponse: IHttpResponse = {
      statusCode: 200,
      headers: {
        "my-header": "header-value",
      },
    };

    const dataObject = {};
    await deserializeHttpMessage(
      struct(
        "",
        "Struct",
        0,
        ["prefixHeaders", "header"],
        [
          [map("", "Map", 0, 0, 0), { httpPrefixHeaders: "my-" }],
          [0, { httpHeader: "my-header" }],
        ]
      ),
      {} as any,
      httpResponse,
      dataObject
    );
    expect(dataObject).toEqual({
      // headers were ignored
    });
  });

  describe("event stream serde", () => {
    const impl = {
      serializer: new ToStringShapeSerializer({
        timestampFormat: { default: 7, useTrait: true },
      }),
      deserializer: new FromStringShapeDeserializer({
        httpBindings: true,
        timestampFormat: { default: 7, useTrait: true },
      }),
      getEventStreamMarshaller() {
        return this.serdeContext.eventStreamMarshaller;
      },
      serdeContext: {
        eventStreamMarshaller: {
          serialize: vi.fn().mockImplementation((eventStream, eventStreamSerializationFn) => {
            return Readable.from({
              async *[Symbol.asyncIterator]() {
                for await (const inputEvent of eventStream) {
                  yield eventStreamSerializationFn(inputEvent);
                }
              },
            });
          }),
          deserialize: vi.fn().mockImplementation((body, eventStreamDeserializationFn) => {
            return {
              async *[Symbol.asyncIterator]() {
                for await (const outputEvent of body) {
                  yield eventStreamDeserializationFn(outputEvent);
                }
              },
            };
          }),
        },
      },
      getDefaultContentType() {
        return "unit/test";
      },
    };

    const serializeEventStream = (HttpProtocol.prototype as any).serializeEventStream.bind(impl);
    const deserializeEventStream = (HttpProtocol.prototype as any).deserializeEventStream.bind(impl);

    const eventStreamUnionSchema = struct(
      "ns",
      "EventStreamStructure",
      { streaming: 1 },
      ["A", "B", "C"],
      [struct("ns", "A", 0, ["name"], [0]), struct("ns", "B", 0, ["name"], [0]), struct("ns", "C", 0, ["name"], [0])]
    );

    it("serializes event streams", async () => {
      const eventStream = {
        async *[Symbol.asyncIterator]() {
          yield { A: { name: "a" } };
          yield { B: { name: "b" } };
          yield { C: { name: "c" } };
          yield { $unknown: ["D", { name: "d" }] };
        },
      };
      const unionSchema = NormalizedSchema.of(eventStreamUnionSchema);

      const requestBody = serializeEventStream({
        eventStream,
        unionSchema,
      });

      const collect = [];
      for await (const chunk of requestBody) {
        collect.push(chunk);
      }
      expect(
        collect.map((item) => {
          return {
            headers: item.headers,
            body: toUtf8(item.body).replace(/\s+/g, ""),
          };
        })
      ).toEqual([
        {
          headers: {
            ":event-type": { type: "string", value: "A" },
            ":message-type": { type: "string", value: "event" },
            ":content-type": { type: "string", value: "unit/test" },
          },
          body: `{"name":"a"}`,
        },
        {
          headers: {
            ":event-type": { type: "string", value: "B" },
            ":message-type": { type: "string", value: "event" },
            ":content-type": { type: "string", value: "unit/test" },
          },
          body: `{"name":"b"}`,
        },
        {
          headers: {
            ":event-type": { type: "string", value: "C" },
            ":message-type": { type: "string", value: "event" },
            ":content-type": { type: "string", value: "unit/test" },
          },
          body: `{"name":"c"}`,
        },
        {
          headers: {
            ":event-type": { type: "string", value: "D" },
            ":message-type": { type: "string", value: "event" },
            ":content-type": { type: "string", value: "unit/test" },
          },
          body: `{"name":"d"}`,
        },
      ]);
    });

    it("deserializes event streams", async () => {
      const response = new HttpResponse({
        statusCode: 200,
        body: {
          async *[Symbol.asyncIterator]() {
            yield { A: { headers: {}, body: { name: "a" } } };
            yield { B: { headers: {}, body: { name: "b" } } };
            yield { C: { headers: {}, body: { name: "c" } } };
            yield { D: { headers: {}, body: { name: "d" } } };
          },
        },
      });
      const unionSchema = NormalizedSchema.of(eventStreamUnionSchema);

      const asyncIterable = deserializeEventStream({
        response,
        unionSchema,
      });

      const collect = [];
      for await (const event of asyncIterable) {
        collect.push(event);
      }
      expect(collect).toEqual([
        { A: { name: "a" } },
        { B: { name: "b" } },
        { C: { name: "c" } },
        { $unknown: { D: { headers: {}, body: { name: "d" } } } },
      ]);
    });
  });
});
