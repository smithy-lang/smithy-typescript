import { NormalizedSchema } from "@smithy/core/schema";
import { nv } from "@smithy/core/serde";
import type {
  BigDecimalSchema,
  StaticSimpleSchema,
  StaticStructureSchema,
  StaticUnionSchema,
  StringSchema,
  TimestampDefaultSchema,
} from "@smithy/types";
import { describe, expect, it } from "vitest";

import { cbor } from "./cbor";
import { tagSymbol } from "./cbor-types";
import { CborCodec, CborShapeSerializer } from "./CborCodec";

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
  const AB$ = [3, "ns", "AB", 0, ["a", "b"], [0, 19 satisfies BigDecimalSchema]] satisfies StaticStructureSchema;

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

    it("can serialize the $unknown union convention", async () => {
      const schema = [
        3,
        "ns",
        "Struct",
        0,
        ["union"],
        [[4, "ns", "Union", 0, ["a", "b", "c"], [0, 0, 0]] satisfies StaticUnionSchema],
      ] satisfies StaticStructureSchema;

      const ns = NormalizedSchema.of(schema);
      const input = {
        union: {
          $unknown: ["d", {}],
        },
      };
      serializer.write(ns, input);
      const serialization = serializer.flush();
      const objectEquivalent = cbor.deserialize(serialization);
      expect(objectEquivalent).toEqual({
        union: {
          d: {},
        },
      });
    });

    it("should pass through NumericValue types if the schema is BigDecimal", async () => {
      const schema = [
        3,
        "ns",
        "Currency",
        0,
        ["price"],
        [19 satisfies BigDecimalSchema],
      ] satisfies StaticStructureSchema;
      const data = {
        price: nv("0.99"),
      };
      serializer.write(NormalizedSchema.of(schema), data);
      const serialized = serializer.flush();
      expect(cbor.deserialize(serialized)).toEqual({
        price: nv("0.99"),
      });
    });

    it("serializes extra document members when encountering __type", async () => {
      const data = {
        __type: "ns#PlateOfFood",
        pasta: "Macaroni",
        cheese: "cheddar",
        a: "a",
        b: nv("-.99"),
      };
      serializer.write(AB$, data);
      const serialization = serializer.flush();
      expect(cbor.deserialize(serialization)).toEqual({
        __type: "ns#PlateOfFood",
        pasta: "Macaroni",
        cheese: "cheddar",
        a: "a",
        b: nv("-0.99"),
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

    it("should pass through NumericValue types if the schema is BigDecimal", async () => {
      const schema = [
        3,
        "ns",
        "Currency",
        0,
        ["price"],
        [19 satisfies BigDecimalSchema],
      ] satisfies StaticStructureSchema;
      const data = cbor.serialize({
        price: nv("0.99"),
      });
      const deserialized = await deserializer.read(NormalizedSchema.of(schema), data);
      expect(deserialized).toEqual({
        price: nv("0.99"),
      });
    });

    it("deserializes unknown union members to the $unknown conventional property", async () => {
      const schema = [
        3,
        "ns",
        "Struct",
        0,
        ["union"],
        [[4, "ns", "Union", 0, ["a", "b", "c"], [0, 0, 0]] satisfies StaticUnionSchema],
      ] satisfies StaticStructureSchema;
      const ns = NormalizedSchema.of(schema);
      const receivedData = {
        union: {
          __type: "ns.Union",
          d: {},
        },
      };
      const serialization = cbor.serialize(receivedData);
      const deserialized = await deserializer.read(ns, serialization);
      expect(deserialized).toEqual({
        union: {
          $unknown: ["d", {}],
        },
      } satisfies Record<string, unknown>);
    });

    it("deserializes extra document members when encountering __type", async () => {
      expect(
        await deserializer.read(
          AB$,
          cbor.serialize({
            __type: "ns#Other",
            __field__: "xyz",
            blob: "AAAA",
            nested: {},
            a: "a",
            b: nv("-0.99"),
          })
        )
      ).toEqual({
        __type: "ns#Other",
        __field__: "xyz",
        blob: "AAAA",
        nested: {},
        a: "a",
        b: nv("-0.99"),
      });
    });
  });
});
