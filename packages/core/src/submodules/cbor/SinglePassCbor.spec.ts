import { nv } from "@smithy/core/serde";
import type {
  BigDecimalSchema,
  BlobSchema,
  DocumentSchema,
  NumericSchema,
  StaticListSchema,
  StaticMapSchema,
  StaticSimpleSchema,
  StaticStructureSchema,
  StaticUnionSchema,
  TimestampDefaultSchema,
} from "@smithy/types";
import { describe, expect, it } from "vitest";

import { CborCodec } from "./CborCodec";
import { SinglePassCborShapeSerializer } from "./SinglePassCborShapeSerializer";
import { SinglePassCborShapeDeserializer } from "./SinglePassCborShapeDeserializer";
import { cbor } from "./cbor";

describe("SinglePassCborShapeSerializer", () => {
  const singlePass = new SinglePassCborShapeSerializer();
  const codec = new CborCodec();
  const multiPass = codec.createSerializer();

  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const dateSchema = [
    3,
    "ns",
    "DateContainer",
    0,
    ["timestamp"],
    [4 satisfies TimestampDefaultSchema],
  ] satisfies StaticStructureSchema;

  describe("equivalency with CborShapeSerializer", () => {
    it("serializes a simple struct", () => {
      const schema = [
        3,
        "ns",
        "Simple",
        0,
        ["name", "age", "active"],
        [0, 1 satisfies NumericSchema, 2],
      ] satisfies StaticStructureSchema;
      const data = { name: "Alice", age: 30, active: true };

      multiPass.write(schema, data);
      const multiBytes = multiPass.flush();

      singlePass.write(schema, data);
      const singleBytes = singlePass.flush();

      expect(cbor.deserialize(singleBytes)).toEqual(cbor.deserialize(multiBytes));
    });

    it("serializes nested structs", () => {
      const schema = [
        3,
        "ns",
        "Outer",
        0,
        ["id", "inner"],
        [0, [3, "ns", "Inner", 0, ["x", "y"], [1 satisfies NumericSchema, 1 satisfies NumericSchema]]],
      ] satisfies StaticStructureSchema;
      const data = { id: "abc", inner: { x: 10, y: 20 } };

      multiPass.write(schema, data);
      const multiBytes = multiPass.flush();

      singlePass.write(schema, data);
      const singleBytes = singlePass.flush();

      expect(cbor.deserialize(singleBytes)).toEqual(cbor.deserialize(multiBytes));
    });

    it("serializes lists of primitives", () => {
      const schema = [1, "ns", "NumList", 0, 1 satisfies NumericSchema] satisfies StaticListSchema;
      const data = [1, 2, 3, -100, 0, 999999];

      multiPass.write(schema, data);
      const multiBytes = multiPass.flush();

      singlePass.write(schema, data);
      const singleBytes = singlePass.flush();

      expect(cbor.deserialize(singleBytes)).toEqual(cbor.deserialize(multiBytes));
    });

    it("serializes lists of structs", () => {
      const schema = [
        1,
        "ns",
        "StructList",
        0,
        [3, "ns", "Item", 0, ["key", "value"], [0, 0]],
      ] satisfies StaticListSchema;
      const data = [
        { key: "a", value: "1" },
        { key: "b", value: "2" },
      ];

      multiPass.write(schema, data);
      const multiBytes = multiPass.flush();

      singlePass.write(schema, data);
      const singleBytes = singlePass.flush();

      expect(cbor.deserialize(singleBytes)).toEqual(cbor.deserialize(multiBytes));
    });

    it("serializes maps", () => {
      const schema = [2, "ns", "StringMap", 0, 0, 0] satisfies StaticMapSchema;
      const data = { hello: "world", foo: "bar" };

      multiPass.write(schema, data);
      const multiBytes = multiPass.flush();

      singlePass.write(schema, data);
      const singleBytes = singlePass.flush();

      expect(cbor.deserialize(singleBytes)).toEqual(cbor.deserialize(multiBytes));
    });

    it("serializes timestamps as tag 1", () => {
      const data = { timestamp: new Date(1718000000000) };

      multiPass.write(dateSchema, data);
      const multiBytes = multiPass.flush();

      singlePass.write(dateSchema, data);
      const singleBytes = singlePass.flush();

      expect(cbor.deserialize(singleBytes)).toEqual(cbor.deserialize(multiBytes));
    });

    it("serializes blobs as byte strings", () => {
      const schema = [3, "ns", "BlobStruct", 0, ["data"], [21 satisfies BlobSchema]] satisfies StaticStructureSchema;
      const data = { data: new Uint8Array([1, 2, 3, 4, 5]) };

      multiPass.write(schema, data);
      const multiBytes = multiPass.flush();

      singlePass.write(schema, data);
      const singleBytes = singlePass.flush();

      expect(cbor.deserialize(singleBytes)).toEqual(cbor.deserialize(multiBytes));
    });

    it("serializes bigints", () => {
      const schema = [
        3,
        "ns",
        "BigStruct",
        0,
        ["big"],
        [17 satisfies BigDecimalSchema],
      ] satisfies StaticStructureSchema;
      const data = { big: BigInt("12345678901234567890") };

      multiPass.write(schema, data);
      const multiBytes = multiPass.flush();

      singlePass.write(schema, data);
      const singleBytes = singlePass.flush();

      expect(cbor.deserialize(singleBytes)).toEqual(cbor.deserialize(multiBytes));
    });

    it("serializes NumericValue as decimal fraction", () => {
      const schema = [
        3,
        "ns",
        "Currency",
        0,
        ["price"],
        [19 satisfies BigDecimalSchema],
      ] satisfies StaticStructureSchema;
      const data = { price: nv("0.99") };

      multiPass.write(schema, data);
      const multiBytes = multiPass.flush();

      singlePass.write(schema, data);
      const singleBytes = singlePass.flush();

      expect(cbor.deserialize(singleBytes)).toEqual(cbor.deserialize(multiBytes));
    });

    it("serializes unions with $unknown", () => {
      const unionSchema = [4, "ns", "Union", 0, ["a", "b"], [0, 0]] satisfies StaticUnionSchema;
      const data = { $unknown: ["c", "hello"] };

      multiPass.write(unionSchema, data);
      const multiBytes = multiPass.flush();

      singlePass.write(unionSchema, data);
      const singleBytes = singlePass.flush();

      expect(cbor.deserialize(singleBytes)).toEqual(cbor.deserialize(multiBytes));
    });

    it("omits null/undefined members from structs", () => {
      const schema = [3, "ns", "Sparse", 0, ["a", "b", "c"], [0, 0, 0]] satisfies StaticStructureSchema;
      const data = { a: "present", b: null, c: undefined };

      multiPass.write(schema, data);
      const multiBytes = multiPass.flush();

      singlePass.write(schema, data);
      const singleBytes = singlePass.flush();

      expect(cbor.deserialize(singleBytes)).toEqual(cbor.deserialize(multiBytes));
      expect(cbor.deserialize(singleBytes)).toEqual({ a: "present" });
    });

    it("handles sparse lists", () => {
      const schema = [1, "ns", "SparseList", { sparse: 1 }, 0] satisfies StaticListSchema;
      const data = ["a", null, "c", null];

      multiPass.write(schema, data);
      const multiBytes = multiPass.flush();

      singlePass.write(schema, data);
      const singleBytes = singlePass.flush();

      expect(cbor.deserialize(singleBytes)).toEqual(cbor.deserialize(multiBytes));
    });
  });

  describe("serialization", () => {
    it("generates idempotency tokens", () => {
      const schema = [
        3,
        "ns",
        "S",
        0,
        ["token"],
        [[0, { idempotencyToken: 1 }] satisfies StaticSimpleSchema],
      ] satisfies StaticStructureSchema;

      singlePass.write(schema, { token: undefined });
      const bytes = singlePass.flush();
      const result = cbor.deserialize(bytes);
      expect(result.token).toMatch(UUID_V4);
    });

    it("serializes floats and integers correctly", () => {
      const schema = [1, "ns", "L", 0, 1 satisfies NumericSchema] satisfies StaticListSchema;
      const data = [0, 1, -1, 3.14, -0.5, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];

      singlePass.write(schema, data);
      const bytes = singlePass.flush();
      expect(cbor.deserialize(bytes)).toEqual(data);
    });

    it("serializes booleans and null", () => {
      const schema = [1, "ns", "L", { sparse: 1 }, 15 satisfies DocumentSchema] satisfies StaticListSchema;
      const data = [true, false, null];

      singlePass.write(schema, data);
      const bytes = singlePass.flush();
      expect(cbor.deserialize(bytes)).toEqual(data);
    });

    it("serializes non-ASCII strings", () => {
      const schema = [3, "ns", "S", 0, ["greeting"], [0]] satisfies StaticStructureSchema;
      const data = { greeting: "こんにちは世界 🌍" };

      singlePass.write(schema, data);
      const bytes = singlePass.flush();
      expect(cbor.deserialize(bytes)).toEqual(data);
    });
  });
});

describe("SinglePassCborShapeDeserializer", () => {
  const singlePassDe = new SinglePassCborShapeDeserializer();
  const codec = new CborCodec();
  const multiPassDe = codec.createDeserializer();
  const singlePassSer = new SinglePassCborShapeSerializer();

  const dateSchema = [
    3,
    "ns",
    "DateContainer",
    0,
    ["timestamp"],
    [4 satisfies TimestampDefaultSchema],
  ] satisfies StaticStructureSchema;

  /**
   * Helper: serialize data with single-pass serializer, then deserialize with both
   * and compare results.
   */
  function assertEquivalentDeserialization(schema: any, data: any) {
    singlePassSer.write(schema, data);
    const bytes = singlePassSer.flush();

    const singleResult = singlePassDe.read(schema, bytes);
    const multiResult = multiPassDe.read(schema, bytes);
    expect(singleResult).toEqual(multiResult);
    return singleResult;
  }

  describe("equivalency with CborShapeDeserializer", () => {
    it("deserializes a simple struct", () => {
      const schema = [
        3,
        "ns",
        "Simple",
        0,
        ["name", "age", "active"],
        [0, 1 satisfies NumericSchema, 2],
      ] satisfies StaticStructureSchema;
      const data = { name: "Alice", age: 30, active: true };
      const result = assertEquivalentDeserialization(schema, data);
      expect(result).toEqual(data);
    });

    it("deserializes nested structs", () => {
      const schema = [
        3,
        "ns",
        "Outer",
        0,
        ["id", "inner"],
        [0, [3, "ns", "Inner", 0, ["x", "y"], [1 satisfies NumericSchema, 1 satisfies NumericSchema]]],
      ] satisfies StaticStructureSchema;
      const data = { id: "abc", inner: { x: 10, y: 20 } };
      const result = assertEquivalentDeserialization(schema, data);
      expect(result).toEqual(data);
    });

    it("deserializes lists of primitives", () => {
      const schema = [1, "ns", "NumList", 0, 1 satisfies NumericSchema] satisfies StaticListSchema;
      const data = [1, 2, 3, -100, 0, 999999];
      const result = assertEquivalentDeserialization(schema, data);
      expect(result).toEqual(data);
    });

    it("deserializes lists of structs", () => {
      const schema = [
        1,
        "ns",
        "StructList",
        0,
        [3, "ns", "Item", 0, ["key", "value"], [0, 0]],
      ] satisfies StaticListSchema;
      const data = [
        { key: "a", value: "1" },
        { key: "b", value: "2" },
      ];
      const result = assertEquivalentDeserialization(schema, data);
      expect(result).toEqual(data);
    });

    it("deserializes maps", () => {
      const schema = [2, "ns", "StringMap", 0, 0, 0] satisfies StaticMapSchema;
      const data = { hello: "world", foo: "bar" };
      const result = assertEquivalentDeserialization(schema, data);
      expect(result).toEqual(data);
    });

    it("deserializes timestamps from tag 1", () => {
      const data = { timestamp: new Date(1718000000000) };
      const result = assertEquivalentDeserialization(dateSchema, data);
      expect(result).toEqual(data);
    });

    it("deserializes blobs as Uint8Array", () => {
      const schema = [3, "ns", "BlobStruct", 0, ["data"], [21 satisfies BlobSchema]] satisfies StaticStructureSchema;
      const data = { data: new Uint8Array([1, 2, 3, 4, 5]) };
      const result = assertEquivalentDeserialization(schema, data);
      expect(result.data).toBeInstanceOf(Uint8Array);
      expect(Array.from(result.data)).toEqual([1, 2, 3, 4, 5]);
    });

    it("deserializes NumericValue", () => {
      const schema = [
        3,
        "ns",
        "Currency",
        0,
        ["price"],
        [19 satisfies BigDecimalSchema],
      ] satisfies StaticStructureSchema;
      const data = { price: nv("0.99") };
      const result = assertEquivalentDeserialization(schema, data);
      expect(result).toEqual(data);
    });

    it("deserializes unknown union members to $unknown", () => {
      const schema = [
        3,
        "ns",
        "Wrapper",
        0,
        ["union"],
        [[4, "ns", "Union", 0, ["a", "b"], [0, 0]] satisfies StaticUnionSchema],
      ] satisfies StaticStructureSchema;

      // Serialize with an unknown key "c" (simulating a newer service).
      const wireData = cbor.serialize({ union: { c: "new_value" } });

      const singleResult = singlePassDe.read(schema, wireData);
      const multiResult = multiPassDe.read(schema, wireData);
      expect(singleResult).toEqual(multiResult);
      expect(singleResult).toEqual({ union: { $unknown: ["c", "new_value"] } });
    });

    it("omits null values from struct output", () => {
      const schema = [3, "ns", "S", 0, ["a", "b"], [0, 0]] satisfies StaticStructureSchema;

      const wireData = cbor.serialize({ a: "hello", b: null });

      const singleResult = singlePassDe.read(schema, wireData);
      const multiResult = multiPassDe.read(schema, wireData);
      expect(singleResult).toEqual(multiResult);
      expect(singleResult).toEqual({ a: "hello" });
      expect("b" in singleResult).toBe(false);
    });

    it("deserializes floats", () => {
      const schema = [1, "ns", "L", 0, 1 satisfies NumericSchema] satisfies StaticListSchema;
      const data = [3.14, -0.5, 1e100, 0.1];
      const result = assertEquivalentDeserialization(schema, data);
      expect(result).toEqual(data);
    });

    it("deserializes negative integers", () => {
      const schema = [1, "ns", "L", 0, 1 satisfies NumericSchema] satisfies StaticListSchema;
      const data = [-1, -255, -65536, -2147483648];
      const result = assertEquivalentDeserialization(schema, data);
      expect(result).toEqual(data);
    });

    it("deserializes non-ASCII struct keys via byte matching", () => {
      const schema = [3, "ns", "S", 0, ["名前", "値"], [0, 1 satisfies NumericSchema]] satisfies StaticStructureSchema;
      const data = { 名前: "テスト", 値: 42 };
      const result = assertEquivalentDeserialization(schema, data);
      expect(result).toEqual(data);
    });

    it("handles structs with many members and sparse data", () => {
      const schema = [
        3,
        "ns",
        "Wide",
        0,
        ["a", "b", "c", "d", "e", "f", "g", "h"],
        [0, 0, 0, 0, 0, 0, 0, 0],
      ] satisfies StaticStructureSchema;

      // Only some members present on wire.
      const wireData = cbor.serialize({ b: "B", e: "E", h: "H" });

      const singleResult = singlePassDe.read(schema, wireData);
      const multiResult = multiPassDe.read(schema, wireData);
      expect(singleResult).toEqual(multiResult);
      expect(singleResult).toEqual({ b: "B", e: "E", h: "H" });
    });
  });

  describe("deserialization", () => {
    it("deserializes booleans and null", () => {
      const schema = [1, "ns", "L", 0, 15 satisfies DocumentSchema] satisfies StaticListSchema;
      const wireData = cbor.serialize([true, false, null]);
      const result = singlePassDe.read(schema, wireData);
      expect(result).toEqual([true, false, null]);
    });

    it("deserializes bigints", () => {
      const schema = [1, "ns", "L", 0, 15 satisfies DocumentSchema] satisfies StaticListSchema;
      const wireData = cbor.serialize([BigInt("9007199254740993"), BigInt("-9007199254740993")]);
      const result = singlePassDe.read(schema, wireData);
      expect(result).toEqual([BigInt("9007199254740993"), BigInt("-9007199254740993")]);
    });

    it("roundtrips through serialize then deserialize", () => {
      const schema = [
        3,
        "ns",
        "Complex",
        0,
        ["id", "tags", "metadata", "created"],
        [
          0,
          [1, "ns", "Tags", 0, 0],
          [2, "ns", "Meta", 0, 0, 1 satisfies NumericSchema],
          4 satisfies TimestampDefaultSchema,
        ],
      ] satisfies StaticStructureSchema;

      const data = {
        id: "item-123",
        tags: ["fast", "binary", "compact"],
        metadata: { version: 2, priority: 1 },
        created: new Date(1700000000000),
      };

      singlePassSer.write(schema, data);
      const bytes = singlePassSer.flush();
      const result = singlePassDe.read(schema, bytes);

      expect(result).toEqual(data);
    });
  });
});
