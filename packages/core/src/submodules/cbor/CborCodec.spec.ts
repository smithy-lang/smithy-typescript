import { NormalizedSchema } from "@smithy/core/schema";
import type { StaticSimpleSchema, StaticStructureSchema, StringSchema, TimestampDefaultSchema } from "@smithy/types";
import { describe, expect, it } from "vitest";

import { cbor } from "./cbor";
import { CborCodec, CborShapeSerializer } from "./CborCodec";
import { tagSymbol } from "./cbor-types";

describe(CborShapeSerializer.name, () => {
  const codec = new CborCodec();

  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const idempotencyTokenSchemas = [
    NormalizedSchema.of([0, "", "StringWithTraits", 0b0100, 0] satisfies StaticSimpleSchema),
    NormalizedSchema.of([0, "", "StringWithTraits", { idempotencyToken: 1 }, 0] satisfies StaticSimpleSchema),
  ];

  const plainSchemas = [
    NormalizedSchema.of(0 satisfies StringSchema),
    NormalizedSchema.of([0, "", "StringWithTraits", 0, 0] satisfies StaticSimpleSchema),
    NormalizedSchema.of([0, "", "StringWithTraits", {}, 0] satisfies StaticSimpleSchema),
  ];

  const serializer = codec.createSerializer();
  const deserializer = codec.createDeserializer();

  const dateSchema = [
    3,
    "ns",
    "DateContainer",
    0,
    ["timestamp"],
    [4 satisfies TimestampDefaultSchema],
  ] satisfies StaticStructureSchema;

  describe("serialization", () => {
    it("should generate an idempotency token when the input for such a member is undefined", () => {
      for (const idempotencyTokenSchema of idempotencyTokenSchemas) {
        for (const plainSchema of plainSchemas) {
          const objectSchema = [
            3,
            "ns",
            "StructWithIdempotencyToken",
            0,
            ["idempotencyToken", "plainString", "memberTraitToken"],
            [idempotencyTokenSchema, plainSchema, [() => plainSchema, 0b0100]],
          ] satisfies StaticStructureSchema;

          serializer.write(objectSchema, {
            idempotencyToken: undefined,
            plainString: undefined,
            memberTraitToken: undefined,
          });
          expect(cbor.deserialize(serializer.flush())).toMatchObject({
            idempotencyToken: UUID_V4,
            memberTraitToken: UUID_V4,
          });

          serializer.write(objectSchema, {
            idempotencyToken: undefined,
            plainString: "abc",
          });
          expect(cbor.deserialize(serializer.flush())).toMatchObject({
            idempotencyToken: UUID_V4,
            plainString: /^abc$/,
            memberTraitToken: UUID_V4,
          });

          serializer.write(objectSchema, {
            idempotencyToken: "jrt",
            plainString: "abc",
            memberTraitToken: "qrf",
          });
          expect(cbor.deserialize(serializer.flush())).toMatchObject({
            idempotencyToken: "jrt",
            plainString: /^abc$/,
            memberTraitToken: "qrf",
          });
        }
      }
    });

    it("should serialize Dates to tags if the schema is a timestamp", () => {
      serializer.write(dateSchema, { timestamp: new Date(1) });
      const serialization = serializer.flush();

      const parsedWithoutSchema = cbor.deserialize(serialization);
      expect(parsedWithoutSchema).toEqual({
        timestamp: {
          tag: 1,
          value: 0.001,
          [tagSymbol]: true,
        },
      });
    });
  });

  describe("deserialization", () => {
    it("should not create undefined values", async () => {
      const struct = [3, "ns", "Struct", 0, ["sessionId", "tokenId"], [0, 0]] satisfies StaticStructureSchema;

      const data = cbor.serialize({
        sessionId: "abcd",
      });

      const deserialized = deserializer.read(struct, data);

      expect(deserialized).toEqual({
        sessionId: "abcd",
      });

      expect("tokenId" in deserialized).toEqual(false);
    });

    it("should deserialize tags to dates if the schema is a timestamp", async () => {
      const decoded = {
        timestamp: {
          tag: 1,
          value: 0.001,
          [tagSymbol]: true,
        },
      };

      const deserialized = await deserializer.read(dateSchema, cbor.serialize(decoded));

      expect(deserialized).toEqual({
        timestamp: new Date(1),
      });
    });
  });
});
