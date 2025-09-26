import { NormalizedSchema, sim, struct } from "@smithy/core/schema";
import { describe, expect, it } from "vitest";

import { cbor } from "./cbor";
import { CborCodec, CborShapeSerializer } from "./CborCodec";

describe(CborShapeSerializer.name, () => {
  const codec = new CborCodec();

  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const idempotencyTokenSchemas = [
    NormalizedSchema.of(sim("", "StringWithTraits", 0, 0b0100)),
    NormalizedSchema.of(sim("", "StringWithTraits", 0, { idempotencyToken: 1 })),
  ];

  const plainSchemas = [
    NormalizedSchema.of(0),
    NormalizedSchema.of(sim("", "StringWithTraits", 0, 0)),
    NormalizedSchema.of(sim("", "StringWithTraits", 0, {})),
  ];

  const serializer = codec.createSerializer();

  describe("serialization", () => {
    it("should generate an idempotency token when the input for such a member is undefined", () => {
      for (const idempotencyTokenSchema of idempotencyTokenSchemas) {
        for (const plainSchema of plainSchemas) {
          const objectSchema = struct(
            "ns",
            "StructWithIdempotencyToken",
            0,
            ["idempotencyToken", "plainString", "memberTraitToken"],
            [idempotencyTokenSchema, plainSchema, [() => plainSchema, 0b0100]]
          );

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
  });
});
