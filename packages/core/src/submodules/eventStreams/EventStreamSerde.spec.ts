import { FromStringShapeDeserializer, ToStringShapeSerializer } from "@smithy/core/protocols";
import { NormalizedSchema, SCHEMA, struct } from "@smithy/core/schema";
import { HttpResponse } from "@smithy/protocol-http";
import { Schema, SerdeFunctions, ShapeDeserializer } from "@smithy/types";
import { toUtf8 } from "@smithy/util-utf8";
import { Readable } from "node:stream";
import { describe, expect, test as it, vi } from "vitest";

import { EventStreamSerde } from "./EventStreamSerde";

class StructStringDeserializer implements ShapeDeserializer {
  private fromString = new FromStringShapeDeserializer({
    httpBindings: true,
    timestampFormat: { default: 7, useTrait: true },
  });

  public read(schema: Schema, data: any): any {
    const ns = NormalizedSchema.of(schema);
    if (ns.isStructSchema()) {
      const output = {} as any;
      for (const [m, s] of ns.structIterator()) {
        output[m] = this.fromString.read(s, data[m]);
      }
      return output;
    }

    return this.fromString.read(schema, data);
  }

  public setSerdeContext(serdeContext: SerdeFunctions): void {}
}

describe(EventStreamSerde.name, () => {
  describe("event stream serde", () => {
    // this represents elements injected by the HttpProtocol caller.
    const impl = {
      serializer: new ToStringShapeSerializer({
        timestampFormat: { default: 7, useTrait: true },
      }),
      deserializer: new StructStringDeserializer(),
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

    const eventStreamSerde = new EventStreamSerde({
      marshaller: impl.getEventStreamMarshaller(),
      serializer: impl.serializer,
      deserializer: impl.deserializer,
      defaultContentType: impl.getDefaultContentType(),
    });

    const serializeEventStream = eventStreamSerde.serializeEventStream.bind(eventStreamSerde);
    const deserializeEventStream = eventStreamSerde.deserializeEventStream.bind(eventStreamSerde);

    const eventStreamUnionSchema = struct(
      "ns",
      "EventStreamStructure",
      { streaming: 1 },
      ["A", "B", "C"],
      [struct("ns", "A", 0, ["name"], [0]), struct("ns", "B", 0, ["name"], [0]), struct("ns", "C", 0, ["name"], [0])]
    );

    const eventStreamContainerSchema = struct(
      "ns",
      "EventStreamContainer",
      0,
      ["eventStreamMember", "dateMember", "blobMember"],
      [eventStreamUnionSchema, SCHEMA.TIMESTAMP_EPOCH_SECONDS, SCHEMA.BLOB]
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

      const requestBody = await serializeEventStream({
        eventStream,
        requestSchema: NormalizedSchema.of(eventStreamContainerSchema),
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

      const asyncIterable = await deserializeEventStream({
        response,
        responseSchema: NormalizedSchema.of(eventStreamContainerSchema),
      });

      const collect = [];
      for await (const event of asyncIterable) {
        collect.push(event);
      }
      expect(collect).toEqual([
        { A: { name: `a` } },
        { B: { name: `b` } },
        { C: { name: `c` } },
        { $unknown: { D: { headers: {}, body: { name: "d" } } } },
      ]);
    });

    it("serializes event streams containing an initial-request", async () => {
      const eventStream = {
        async *[Symbol.asyncIterator]() {
          yield { A: { name: "a" } };
          yield { B: { name: "b" } };
          yield { C: { name: "c" } };
          yield { $unknown: ["D", { name: "d" }] };
        },
      };

      const requestBody = await serializeEventStream({
        eventStream,
        requestSchema: NormalizedSchema.of(eventStreamContainerSchema),
        initialRequest: {
          dateMember: new Date(0),
          blobMember: new Uint8Array([0, 1, 2, 3]),
        },
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
            ":event-type": { type: "string", value: "initial-request" },
            ":message-type": { type: "string", value: "event" },
            ":content-type": { type: "string", value: "unit/test" },
          },
          body: `{"dateMember":"1970-01-01T00:00:00.000Z","blobMember":{"0":0,"1":1,"2":2,"3":3}}`,
        },
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

    it("deserializes event streams containing an initial-response", async () => {
      const response = new HttpResponse({
        statusCode: 200,
        body: {
          async *[Symbol.asyncIterator]() {
            yield {
              "initial-response": {
                headers: {},
                body: { dateMember: "0", blobMember: "AAECAw==" },
              },
            };
            yield { A: { headers: {}, body: { name: "a" } } };
            yield { B: { headers: {}, body: { name: "b" } } };
            yield { C: { headers: {}, body: { name: "c" } } };
            yield { D: { headers: {}, body: { name: "d" } } };
          },
        },
      });

      const initialResponseContainer = {} as any;

      const asyncIterable = await deserializeEventStream({
        response,
        responseSchema: NormalizedSchema.of(eventStreamContainerSchema),
        initialResponseContainer,
      });

      const collect = [];
      for await (const event of asyncIterable) {
        collect.push(event);
      }
      expect(collect).toEqual([
        { A: { name: `a` } },
        { B: { name: `b` } },
        { C: { name: `c` } },
        { $unknown: { D: { headers: {}, body: { name: "d" } } } },
      ]);
      expect(initialResponseContainer).toEqual({
        dateMember: new Date(0),
        blobMember: new Uint8Array([0, 1, 2, 3]),
      });
    });
  });
});
