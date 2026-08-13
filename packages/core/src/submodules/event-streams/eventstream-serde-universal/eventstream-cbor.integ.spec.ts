// oxlint-disable no-useless-spread
import { Readable } from "node:stream";
import { cbor, dateToTag } from "@smithy/core/cbor";
import { EventStreamCodec } from "../eventstream-codec/EventStreamCodec";
import { HttpResponse } from "@smithy/core/protocols";
import { requireRequestsFrom } from "@smithy/util-test/src";
import { describe, expect, test as it } from "vitest";
import { XYZService } from "xyz";

describe("local model integration test for cbor eventstreams", () => {
  it("should read and write cbor event streams", async () => {
    const client = new XYZService({
      endpoint: "https://localhost",
      apiKey: async () => ({ apiKey: "test-api-key" }),
      clientContextParams: {
        apiKey: "test-api-key",
      },
    });

    const body = cbor.serialize({
      id: "alpha",
      timestamp: dateToTag(new Date(0)),
    });

    function toInt32(n: number): number[] {
      const uint32 = new Uint8Array(4);
      const dv = new DataView(uint32.buffer, 0, 4);
      dv.setUint32(0, n);
      return [...uint32];
    }

    const toUtf8 = (input: Uint8Array): string => new TextDecoder().decode(input);
    const fromUtf8 = (input: string): Uint8Array => new TextEncoder().encode(input);
    const codec = new EventStreamCodec(toUtf8, fromUtf8);

    requireRequestsFrom(client)
      .toMatch({
        hostname: /localhost/,
        async body(body) {
          const outgoing = [];
          for await (const chunk of body) {
            outgoing.push(chunk);
          }
          expect(outgoing).toEqual([
            codec.encode({
              headers: {
                ":event-type": { type: "string", value: "alpha" },
                ":message-type": { type: "string", value: "event" },
                ":content-type": { type: "string", value: "application/cbor" },
              },
              body: cbor.serialize({ id: "alpha" }),
            }),
            codec.encode({
              headers: {
                ":event-type": { type: "string", value: "beta" },
                ":message-type": { type: "string", value: "event" },
                ":content-type": { type: "string", value: "application/cbor" },
              },
              body: cbor.serialize({}),
            }),
            codec.encode({
              headers: {
                ":event-type": { type: "string", value: "gamma" },
                ":message-type": { type: "string", value: "event" },
                ":content-type": { type: "string", value: "application/cbor" },
              },
              body: new Uint8Array(),
            }),
            new Uint8Array(),
          ]);
        },
      })
      .respondWith(
        new HttpResponse({
          statusCode: 200,
          headers: {
            "smithy-protocol": "rpc-v2-cbor",
          },
          body: Readable.from({
            async *[Symbol.asyncIterator]() {
              yield new Uint8Array([
                /* message size */ ...toInt32(91 + body.byteLength),
                /* header size */ ...toInt32(75),
                /* prelude crc */ ...toInt32(1084132878),
                /* headers */
                /* :event-type */
                11,
                ...[58, 101, 118, 101, 110, 116, 45, 116, 121, 112, 101],
                7,
                /* alpha */
                0,
                5,
                ...[97, 108, 112, 104, 97],
                /* :content-type */
                13,
                ...[58, 99, 111, 110, 116, 101, 110, 116, 45, 116, 121, 112, 101],
                7,
                /* application/cbor */
                0,
                16,
                ...[97, 112, 112, 108, 105, 99, 97, 116, 105, 111, 110, 47, 99, 98, 111, 114],
                /* :message-type */
                13,
                ...[58, 109, 101, 115, 115, 97, 103, 101, 45, 116, 121, 112, 101],
                7,
                /* event */
                0,
                5,
                ...[101, 118, 101, 110, 116],

                /* body */
                ...body,

                /* message crc */
                ...toInt32(1938836882),
              ]);
            },
          }),
        })
      );

    const response = await client.tradeEventStream({
      eventStream: {
        async *[Symbol.asyncIterator]() {
          yield {
            alpha: {
              id: "alpha",
            },
          };
          yield {
            beta: {},
          };
          yield {
            gamma: {},
          };
        },
      },
    });

    const responses = [] as any[];
    for await (const event of response.eventStream ?? []) {
      responses.push(event);
    }

    expect(responses).toEqual([
      {
        alpha: {
          id: "alpha",
          timestamp: new Date(0),
        },
      },
    ]);
  });
});
