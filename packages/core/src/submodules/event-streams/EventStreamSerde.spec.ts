import { cbor, CborCodec, dateToTag } from "@smithy/core/cbor";
import { NormalizedSchema, SCHEMA, sim, struct } from "@smithy/core/schema";
import { EventStreamMarshaller } from "@smithy/eventstream-serde-node";
import { HttpResponse } from "@smithy/protocol-http";
import type { Message as EventMessage } from "@smithy/types";
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

    const eventStreamUnionSchema = struct(
      "ns",
      "EventStreamStructure",
      { streaming: 1 },
      ["A", "B", "C", "Payload", "TextPayload", "CustomHeaders"],
      // D is omitted to represent an unknown event.
      [
        struct("ns", "A", 0, ["name"], [0]),
        struct("ns", "B", 0, ["name"], [0]),
        struct("ns", "C", 0, ["name"], [0]),
        struct(
          "ns",
          "Payload",
          0,
          ["payload"],
          [sim("ns", "StreamingBlobPayload", SCHEMA.STREAMING_BLOB, { eventPayload: 1 })]
        ),
        struct("ns", "TextPayload", 0, ["payload"], [sim("ns", "TextPayload", SCHEMA.STRING, { eventPayload: 1 })]),
        struct(
          "ns",
          "CustomHeaders",
          0,
          ["header1", "header2"],
          [sim("ns", "EventHeader", 0, { eventHeader: 1 }), sim("ns", "EventHeader", 0, { eventHeader: 1 })]
        ),
      ]
    );

    const eventStreamContainerSchema = struct(
      "ns",
      "EventStreamContainer",
      0,
      // here the non-eventstream members form an initial-request
      // or initial-response when present.
      ["eventStreamMember", "dateMember", "blobMember"],
      [eventStreamUnionSchema, SCHEMA.TIMESTAMP_EPOCH_SECONDS, SCHEMA.BLOB]
    );

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
          yield { CustomHeaders: { header1: "h1", header2: "h2" } };
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
        return {
          headers: {
            ":message-type": { type: "string", value: "event" },
            ":event-type": { type: "string", value: eventType },
            ":content-type": { type: "string", value: "application/cbor" },
          },
          body: cbor.serialize(event[eventType]),
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
          yield { CustomHeaders: { header1: "h1", header2: "h2" } };
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
          { CustomHeaders: { header1: "h1", header2: "h2" } },
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
          { CustomHeaders: { header1: "h1", header2: "h2" } },
        ]);

        expect(initialResponseContainer).toEqual({
          dateMember: new Date(0),
          blobMember: new Uint8Array([0, 1, 2, 3]),
        });
      });
    });
  });
});
