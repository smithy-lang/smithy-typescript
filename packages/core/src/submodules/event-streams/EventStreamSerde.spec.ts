import { cbor, CborCodec, dateToTag } from "@smithy/core/cbor";
import { NormalizedSchema } from "@smithy/core/schema";
import { EventStreamMarshaller } from "@smithy/eventstream-serde-node";
import { HttpResponse } from "@smithy/protocol-http";
import type {
  BlobSchema,
  BooleanSchema,
  Message as EventMessage,
  NumericSchema,
  StaticSimpleSchema,
  StaticStructureSchema,
  StringSchema,
  TimestampEpochSecondsSchema,
} from "@smithy/types";
import { fromUtf8, toUtf8 } from "@smithy/util-utf8";
import { describe, expect, test as it } from "vitest";

import { EventStreamSerde } from "./EventStreamSerde";

describe(EventStreamSerde.name, () => {
  describe("event stream serde", () => {
    const cborCodec = new CborCodec();

    // this represents elements injected by the HttpProtocol caller.
    // we use the real event stream marshaller (universal) here to get an accurate integration test.
    const impl = {
      serializer: cborCodec.createSerializer(),
      deserializer: cborCodec.createDeserializer(),
      getEventStreamMarshaller() {
        return this.serdeContext.eventStreamMarshaller;
      },
      serdeContext: {
        eventStreamMarshaller: new EventStreamMarshaller({
          utf8Encoder: toUtf8,
          utf8Decoder: fromUtf8,
        }),
      },
      getDefaultContentType() {
        return "application/cbor";
      },
    };

    const eventStreamSerde = new EventStreamSerde({
      marshaller: impl.getEventStreamMarshaller(),
      serializer: impl.serializer,
      deserializer: impl.deserializer,
      defaultContentType: impl.getDefaultContentType(),
    });

    const eventStreamUnionSchema = [
      3,
      "ns",
      "EventStreamStructure",
      { streaming: 1 },
      ["A", "B", "C", "Payload", "TextPayload", "CustomHeaders"],
      // D is omitted to represent an unknown event.
      [
        [3, "ns", "A", 0, ["name"], [0]] satisfies StaticStructureSchema,
        [3, "ns", "B", 0, ["name"], [0]] satisfies StaticStructureSchema,
        [3, "ns", "C", 0, ["name"], [0]] satisfies StaticStructureSchema,
        [
          3,
          "ns",
          "Payload",
          0,
          ["payload"],
          [[0, "ns", "BlobPayload", { eventPayload: 1 }, 21 satisfies BlobSchema] satisfies StaticSimpleSchema],
        ],
        [
          3,
          "ns",
          "TextPayload",
          0,
          ["payload"],
          [[0, "ns", "TextPayload", { eventPayload: 1 }, 0 satisfies StringSchema] satisfies StaticSimpleSchema],
        ],
        [
          3,
          "ns",
          "CustomHeaders",
          0,
          ["header1", "header2", "header-date", "header-number", "header-boolean", "header-blob"],
          [
            [0, "ns", "EventHeader", { eventHeader: 1 }, 0 satisfies StringSchema] satisfies StaticSimpleSchema,
            [0, "ns", "EventHeader", { eventHeader: 1 }, 0 satisfies StringSchema] satisfies StaticSimpleSchema,

            [
              0,
              "ns",
              "EventHeader",
              { eventHeader: 1 },
              7 satisfies TimestampEpochSecondsSchema,
            ] satisfies StaticSimpleSchema,
            [0, "ns", "EventHeader", { eventHeader: 1 }, 1 satisfies NumericSchema] satisfies StaticSimpleSchema,
            [0, "ns", "EventHeader", { eventHeader: 1 }, 2 satisfies BooleanSchema] satisfies StaticSimpleSchema,
            [0, "ns", "EventHeader", { eventHeader: 1 }, 21 satisfies BlobSchema] satisfies StaticSimpleSchema,
          ],
        ],
      ],
    ] satisfies StaticStructureSchema;

    const eventStreamContainerSchema = [
      3,
      "ns",
      "EventStreamContainer",
      0,
      // here the non-eventstream members form an initial-request
      // or initial-response when present.
      ["eventStreamMember", "dateMember", "blobMember"],
      [eventStreamUnionSchema, 7 satisfies TimestampEpochSecondsSchema, 21 satisfies BlobSchema],
    ] satisfies StaticStructureSchema;

    describe("serialization", () => {
      async function messageDeserializer(event: Record<string, EventMessage>): Promise<any> {
        return event;
      }

      const eventStreamCallerInput = {
        async *[Symbol.asyncIterator]() {
          yield { A: { name: "a" } };
          yield { B: { name: "b" } };
          yield { C: { name: "c" } };
          yield { $unknown: ["D", { name: "d" }] };
          yield { Payload: { payload: new Uint8Array([0, 1, 2, 3, 4, 5, 6]) } };
          yield { TextPayload: { payload: "beep boop" } };
          yield {
            CustomHeaders: {
              header1: "h1",
              header2: "h2",
              "header-date": new Date(0),
              "header-number": -2,
              "header-boolean": false,
              "header-blob": new Uint8Array([0, 1, 2, 3]),
            },
          };
        },
      };

      const canonicalEvents = [
        {
          headers: {
            ":event-type": { type: "string", value: "A" },
            ":message-type": { type: "string", value: "event" },
            ":content-type": { type: "string", value: "application/cbor" },
          },
          body: { name: "a" },
        },
        {
          headers: {
            ":event-type": { type: "string", value: "B" },
            ":message-type": { type: "string", value: "event" },
            ":content-type": { type: "string", value: "application/cbor" },
          },
          body: { name: "b" },
        },
        {
          headers: {
            ":event-type": { type: "string", value: "C" },
            ":message-type": { type: "string", value: "event" },
            ":content-type": { type: "string", value: "application/cbor" },
          },
          body: { name: "c" },
        },
        {
          headers: {
            ":event-type": { type: "string", value: "D" },
            ":message-type": { type: "string", value: "event" },
            ":content-type": { type: "string", value: "application/cbor" },
          },
          body: { name: "d" },
        },
        {
          headers: {
            ":event-type": { type: "string", value: "Payload" },
            ":message-type": { type: "string", value: "event" },
            ":content-type": { type: "string", value: "application/octet-stream" },
          },
          body: new Uint8Array([0, 1, 2, 3, 4, 5, 6]),
        },
        {
          headers: {
            ":event-type": { type: "string", value: "TextPayload" },
            ":message-type": { type: "string", value: "event" },
            ":content-type": { type: "string", value: "text/plain" },
          },
          body: "beep boop",
        },
        {
          headers: {
            ":event-type": { type: "string", value: "CustomHeaders" },
            ":message-type": { type: "string", value: "event" },
            ":content-type": { type: "string", value: "application/cbor" },
            header1: { type: "string", value: "h1" },
            header2: { type: "string", value: "h2" },
            "header-boolean": {
              type: "boolean",
              value: false,
            },
            "header-date": {
              type: "timestamp",
              value: new Date(0),
            },
            "header-number": {
              type: "integer",
              value: -2,
            },
            "header-blob": {
              type: "binary",
              value: new Uint8Array([0, 1, 2, 3]),
            },
          },
          body: {},
        },
      ];

      /**
       * Takes an outgoing request requestBody of event streams,
       * collects it, and maps to the canonical object form.
       */
      async function collectTranslate(requestBody: any) {
        const reparsed = impl.getEventStreamMarshaller().deserialize(requestBody, messageDeserializer);

        const collect = [];
        for await (const chunk of reparsed) {
          collect.push(chunk);
        }

        return collect.map((item) => {
          const object = Object.values(item)[0] as any;
          return {
            headers: object.headers,
            body: cbor.deserialize(object.body),
          };
        });
      }

      it("serializes event streams", async () => {
        const requestBody = await eventStreamSerde.serializeEventStream({
          eventStream: eventStreamCallerInput,
          requestSchema: NormalizedSchema.of(eventStreamContainerSchema),
        });

        expect(await collectTranslate(requestBody)).toEqual(canonicalEvents);
      });

      it("serializes event streams containing an initial-request", async () => {
        const requestBody = await eventStreamSerde.serializeEventStream({
          eventStream: eventStreamCallerInput,
          requestSchema: NormalizedSchema.of(eventStreamContainerSchema),
          initialRequest: {
            dateMember: new Date(0),
            blobMember: new Uint8Array([0, 1, 2, 3]),
          },
        });

        expect(await collectTranslate(requestBody)).toEqual([
          {
            headers: {
              ":event-type": { type: "string", value: "initial-request" },
              ":message-type": { type: "string", value: "event" },
              ":content-type": { type: "string", value: "application/cbor" },
            },
            body: {
              blobMember: new Uint8Array([0, 1, 2, 3]),
              dateMember: dateToTag(new Date(0)),
            },
          },
          ...canonicalEvents,
        ]);
      });
    });

    describe("deserialization", () => {
      /**
       * Converts a canonical event to a JS object representation
       * of an event stream event.
       */
      function messageSerializer(event: any): EventMessage {
        const eventType = Object.keys(event)[0];
        const data = event[eventType];

        const headerKeys = Object.keys(data).filter((k) => k.startsWith("header"));
        const headers = {
          ":message-type": { type: "string", value: "event" },
          ":event-type": { type: "string", value: eventType },
          ":content-type": { type: "string", value: "application/cbor" },
        } as any;

        for (const key of headerKeys) {
          const v = data[key];
          if (v instanceof Date) {
            headers[key] = {
              type: "timestamp",
              value: data[key],
            };
          } else if (typeof v === "boolean") {
            headers[key] = {
              type: "boolean",
              value: data[key],
            };
          } else if (typeof v === "string") {
            headers[key] = {
              type: "string",
              value: data[key],
            };
          } else if (typeof v === "number") {
            headers[key] = {
              type: "integer",
              value: v,
            };
          } else if (v instanceof Uint8Array) {
            headers[key] = {
              type: "binary",
              value: v,
            };
          } else {
            throw new Error("unhandled type");
          }

          delete data[key];
        }

        const payload = data.payload;
        if (payload) {
          return {
            headers,
            body: typeof payload === "string" ? fromUtf8(payload) : payload,
          };
        }

        return {
          headers,
          body: cbor.serialize(data),
        };
      }

      const eventStreamMarshaller = impl.getEventStreamMarshaller();

      const canonicalEvents = {
        async *[Symbol.asyncIterator]() {
          yield { A: { name: "a" } };
          yield { B: { name: "b" } };
          yield { C: { name: "c" } };
          yield { D: { name: "d" } };
          yield { Payload: { payload: new Uint8Array([0, 1, 2, 3, 4, 5, 6]) } };
          yield { TextPayload: { payload: "boop beep" } };
          yield {
            CustomHeaders: {
              header1: "h1",
              header2: "h2",
              "header-date": new Date(0),
              "header-number": -2,
              "header-boolean": false,
              "header-blob": new Uint8Array([0, 1, 2, 3]),
            },
          };
        },
      };

      const $unknownEvent = {
        $unknown: {
          D: {
            headers: {
              ":message-type": { type: "string", value: "event" },
              ":event-type": { type: "string", value: "D" },
              ":content-type": { type: "string", value: "application/cbor" },
            },
            body: Uint8Array.from(cbor.serialize({ name: "d" })),
          },
        },
      };
      void $unknownEvent;

      async function collect(asyncIterable: AsyncIterable<any>): Promise<any[]> {
        const collect = [];
        for await (const event of asyncIterable) {
          collect.push(event);
        }
        return collect;
      }

      it("deserializes event streams", async () => {
        const response = new HttpResponse({
          statusCode: 200,
          body: eventStreamMarshaller.serialize(canonicalEvents, messageSerializer),
        });

        const asyncIterable = await eventStreamSerde.deserializeEventStream({
          response,
          responseSchema: NormalizedSchema.of(eventStreamContainerSchema),
        });

        expect(await collect(asyncIterable)).toEqual([
          { A: { name: `a` } },
          { B: { name: `b` } },
          { C: { name: `c` } },
          // todo(schema) getMessageUnmarshaller.ts must be patched to return unknown events.
          // $unknownEvent,
          { Payload: { payload: new Uint8Array([0, 1, 2, 3, 4, 5, 6]) } },
          { TextPayload: { payload: "boop beep" } },
          {
            CustomHeaders: {
              header1: "h1",
              header2: "h2",
              "header-boolean": false,
              "header-date": new Date(0),
              "header-number": -2,
              "header-blob": new Uint8Array([0, 1, 2, 3]),
            },
          },
        ]);
      });

      it("deserializes event streams containing an initial-response", async () => {
        const response = new HttpResponse({
          statusCode: 200,
          body: eventStreamMarshaller.serialize(
            {
              async *[Symbol.asyncIterator]() {
                yield {
                  "initial-response": { dateMember: 0, blobMember: "AAECAw==" },
                };
                for await (const it of canonicalEvents) {
                  yield it;
                }
              },
            },
            messageSerializer
          ),
        });

        const initialResponseContainer = {} as any;

        const asyncIterable = await eventStreamSerde.deserializeEventStream({
          response,
          responseSchema: NormalizedSchema.of(eventStreamContainerSchema),
          initialResponseContainer,
        });

        expect(await collect(asyncIterable)).toEqual([
          { A: { name: `a` } },
          { B: { name: `b` } },
          { C: { name: `c` } },
          // todo(schema) getMessageUnmarshaller.ts must be patched to return unknown events.
          // $unknownEvent,
          { Payload: { payload: new Uint8Array([0, 1, 2, 3, 4, 5, 6]) } },
          { TextPayload: { payload: "boop beep" } },
          {
            CustomHeaders: {
              header1: "h1",
              header2: "h2",
              "header-boolean": false,
              "header-date": new Date(0),
              "header-number": -2,
              "header-blob": new Uint8Array([0, 1, 2, 3]),
            },
          },
        ]);

        expect(initialResponseContainer).toEqual({
          dateMember: new Date(0),
          blobMember: new Uint8Array([0, 1, 2, 3]),
        });
      });
    });
  });
});
