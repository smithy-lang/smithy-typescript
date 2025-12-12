import { cbor, dateToTag } from "@smithy/core/cbor";
import { HttpResponse } from "@smithy/protocol-http";
import { requireRequestsFrom } from "@smithy/util-test/src";
import { Readable } from "node:stream";
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

    requireRequestsFrom(client)
      .toMatch({
        hostname: /localhost/,
        async body(body) {
          const outgoing = [];
          for await (const chunk of body) {
            outgoing.push(chunk);
          }
          expect(outgoing).toEqual([
            new Uint8Array([
              0, 0, 0, 101, 0, 0, 0, 75, 213, 254, 191, 76, 11, 58, 101, 118, 101, 110, 116, 45, 116, 121, 112, 101, 7,
              0, 5, 97, 108, 112, 104, 97, 13, 58, 109, 101, 115, 115, 97, 103, 101, 45, 116, 121, 112, 101, 7, 0, 5,
              101, 118, 101, 110, 116, 13, 58, 99, 111, 110, 116, 101, 110, 116, 45, 116, 121, 112, 101, 7, 0, 16, 97,
              112, 112, 108, 105, 99, 97, 116, 105, 111, 110, 47, 99, 98, 111, 114, 161, 98, 105, 100, 101, 97, 108,
              112, 104, 97, 32, 93, 69, 236,
            ]),
            new Uint8Array([
              0, 0, 0, 91, 0, 0, 0, 74, 188, 232, 137, 61, 11, 58, 101, 118, 101, 110, 116, 45, 116, 121, 112, 101, 7,
              0, 4, 98, 101, 116, 97, 13, 58, 109, 101, 115, 115, 97, 103, 101, 45, 116, 121, 112, 101, 7, 0, 5, 101,
              118, 101, 110, 116, 13, 58, 99, 111, 110, 116, 101, 110, 116, 45, 116, 121, 112, 101, 7, 0, 16, 97, 112,
              112, 108, 105, 99, 97, 116, 105, 111, 110, 47, 99, 98, 111, 114, 160, 195, 209, 62, 47,
            ]),
            new Uint8Array([
              0, 0, 0, 91, 0, 0, 0, 74, 188, 232, 137, 61, 11, 58, 101, 118, 101, 110, 116, 45, 116, 121, 112, 101, 7,
              0, 4, 98, 101, 116, 97, 13, 58, 109, 101, 115, 115, 97, 103, 101, 45, 116, 121, 112, 101, 7, 0, 5, 101,
              118, 101, 110, 116, 13, 58, 99, 111, 110, 116, 101, 110, 116, 45, 116, 121, 112, 101, 7, 0, 16, 97, 112,
              112, 108, 105, 99, 97, 116, 105, 111, 110, 47, 99, 98, 111, 114, 160, 195, 209, 62, 47,
            ]),
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
