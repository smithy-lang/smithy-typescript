import { hasOwn } from "@smithy/core/transport";
import { fromUtf8, toUtf8 } from "@smithy/core/serde";
import { describe, expect, test as it } from "vitest";

import { EventStreamCodec } from "./EventStreamCodec";
import { vectors } from "./TestVectors.fixture";

describe("eventstream parsing", () => {
  const eventStreamCodec = new EventStreamCodec(toUtf8, fromUtf8);

  for (const vectorName in vectors) {
    if (!hasOwn(vectors, vectorName)) continue;
    const vector = vectors[vectorName];
    it(`should handle the ${vectorName} test case`, () => {
      if (vector.expectation === "failure") {
        expect(() => eventStreamCodec.decode(vector.encoded)).toThrow();
      } else {
        expect(eventStreamCodec.encode(vector.decoded)).toEqual(vector.encoded);
        expect(eventStreamCodec.decode(vector.encoded)).toEqual(vector.decoded);
      }
    });
  }

  describe("header size validation", () => {
    it("should fail to encode a message with a too-long header value", () => {
      expect(() =>
        eventStreamCodec.encode({
          headers: {
            ":event-type": { type: "string", value: "x".repeat(65536) },
          },
          body: new Uint8Array(),
        })
      ).toThrowError("@smithy/core/event-streams - header value (string) exceeds 65535 bytes: 65536");
    });

    it("should fail to encode a message with a too-long header name", () => {
      expect(() =>
        eventStreamCodec.encode({
          headers: {
            ["x".repeat(256)]: { type: "boolean", value: true },
          },
          body: new Uint8Array(),
        })
      ).toThrowError("@smithy/core/event-streams - header name exceeds 255 bytes: 256");
    });
  });
});
