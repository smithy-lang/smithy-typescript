import type {
  $MemberSchema,
  BigDecimalSchema,
  BigIntegerSchema,
  BlobSchema,
  BooleanSchema,
  DocumentSchema,
  ListSchemaModifier,
  MapSchemaModifier,
  NumericSchema,
  StaticListSchema,
  StaticMapSchema,
  StaticSimpleSchema,
  StaticStructureSchema,
  StaticUnionSchema,
  StreamingBlobSchema,
  StringSchema,
  TimestampDefaultSchema,
} from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import { NormalizedSchema } from "./NormalizedSchema";
import { translateTraits } from "./translateTraits";

describe(NormalizedSchema.name, () => {
  const [List, Map, Struct, Union]: [
    StaticListSchema,
    StaticMapSchema,
    () => StaticStructureSchema,
    StaticUnionSchema,
  ] = [
    [1, "ack", "List", { sparse: 1 }, 0] satisfies StaticListSchema,
    [2, "ack", "Map", 0, 0, 1] satisfies StaticMapSchema,
    () => schema,
    [4, "ack", "Union", 0, ["a", "b", "c"], ["unit", 0, 128]],
  ];
  const schema: StaticStructureSchema = [
    3,
    "ack",
    "Structure",
    {},
    ["list", "map", "struct", "union"],
    [List, Map, Struct, Union],
  ];

  const ns = NormalizedSchema.of(schema);
  const nsFromIndirect = NormalizedSchema.of(() => ns);

  it("has a static constructor", () => {
    expect(NormalizedSchema.of(ns)).toBeInstanceOf(NormalizedSchema);
  });

  it("has a name", () => {
    expect(ns.getName()).toEqual("Structure");
    expect(ns.getName(true)).toEqual("ack#Structure");
  });

  describe("inner schema", () => {
    it("has an inner schema", () => {
      // intentional reference equality comparison.
      expect(ns.getSchema()).toBe(schema);
    });
    it("peels NormalizedSchema from its input schemaRef", () => {
      const layered = NormalizedSchema.of(
        NormalizedSchema.of(NormalizedSchema.of(NormalizedSchema.of(NormalizedSchema.of(nsFromIndirect))))
      );
      // intentional reference equality comparison.
      expect(layered.getSchema()).toBe(schema);
    });
  });

  it("translates a bitvector of traits to a traits object", () => {
    expect(translateTraits(0b0000_0000)).toEqual({});
    expect(translateTraits(0b0000_0001)).toEqual({
      httpLabel: 1,
    });
    expect(translateTraits(0b0000_0011)).toEqual({
      httpLabel: 1,
      idempotent: 1,
    });
    expect(translateTraits(0b0000_0110)).toEqual({
      idempotent: 1,
      idempotencyToken: 1,
    });
    expect(translateTraits(0b0000_1100)).toEqual({
      idempotencyToken: 1,
      sensitive: 1,
    });
    expect(translateTraits(0b0001_1000)).toEqual({
      sensitive: 1,
      httpPayload: 1,
    });
    expect(translateTraits(0b0011_0000)).toEqual({
      httpPayload: 1,
      httpResponseCode: 1,
    });
    expect(translateTraits(0b0110_0000)).toEqual({
      httpResponseCode: 1,
      httpQueryParams: 1,
    });
  });

  describe("member schema", () => {
    const member = ns.getMemberSchema("list");

    it("can represent a member schema", () => {
      expect(member).toBeInstanceOf(NormalizedSchema);
      expect(member.isMemberSchema()).toBe(true);
      expect(member.isListSchema()).toBe(true);
      expect(member.getSchema()).toBe(List);
      expect(member.getMemberName()).toBe("list");
    });
  });

  describe("traversal and type identifiers", () => {
    it("type identifiers", () => {
      expect(NormalizedSchema.of("unit").isUnitSchema()).toBe(true);
      expect(NormalizedSchema.of((64 satisfies ListSchemaModifier) | (1 satisfies NumericSchema)).isListSchema()).toBe(
        true
      );
      expect(NormalizedSchema.of((128 satisfies MapSchemaModifier) | (1 satisfies NumericSchema)).isMapSchema()).toBe(
        true
      );

      expect(NormalizedSchema.of(15 satisfies DocumentSchema).isDocumentSchema()).toBe(true);

      expect(NormalizedSchema.of(ns.getMemberSchema("struct")).isStructSchema()).toBe(true);
      expect(NormalizedSchema.of(21 satisfies BlobSchema).isBlobSchema()).toBe(true);
      expect(NormalizedSchema.of(4 satisfies TimestampDefaultSchema).isTimestampSchema()).toBe(true);

      expect(NormalizedSchema.of(0 satisfies StringSchema).isStringSchema()).toBe(true);
      expect(NormalizedSchema.of(2 satisfies BooleanSchema).isBooleanSchema()).toBe(true);
      expect(NormalizedSchema.of(1 satisfies NumericSchema).isNumericSchema()).toBe(true);
      expect(NormalizedSchema.of(17 satisfies BigIntegerSchema).isBigIntegerSchema()).toBe(true);
      expect(NormalizedSchema.of(19 satisfies BigDecimalSchema).isBigDecimalSchema()).toBe(true);
      expect(NormalizedSchema.of(42 satisfies StreamingBlobSchema).isStreaming()).toBe(true);

      const structWithStreamingMember = [
        3,
        "ack",
        "StructWithStreamingMember",
        0,
        ["m"],
        [[0, "ns", "blob", { streaming: 1 }, 21 as BlobSchema] satisfies StaticSimpleSchema],
      ] satisfies StaticStructureSchema;
      expect(NormalizedSchema.of(structWithStreamingMember).getMemberSchema("m").isStreaming()).toBe(true);
    });

    describe("list member", () => {
      it("list itself", () => {
        const member = ns.getMemberSchema("list");
        expect(member.isMemberSchema()).toBe(true);
        expect(member.isListSchema()).toBe(true);
        expect(member.getSchema()).toBe(List);
        expect(member.getMemberName()).toBe("list");
      });
      it("list value member", () => {
        const member = ns.getMemberSchema("list").getValueSchema();
        expect(member.isMemberSchema()).toBe(true);
        expect(member.isListSchema()).toBe(false);
        expect(member.isStringSchema()).toBe(true);
        expect(member.getSchema()).toBe(0);
        expect(member.getMemberName()).toBe("member");
      });
    });
    describe("map member", () => {
      it("map itself", () => {
        const member = ns.getMemberSchema("map");
        expect(member.isMemberSchema()).toBe(true);
        expect(member.isMapSchema()).toBe(true);
        expect(member.getSchema()).toBe(Map);
        expect(member.getMemberName()).toBe("map");
      });
      it("map key member", () => {
        const member = ns.getMemberSchema("map").getKeySchema();
        expect(member.isMemberSchema()).toBe(true);
        expect(member.isNumericSchema()).toBe(false);
        expect(member.isStringSchema()).toBe(true);
        expect(member.getSchema()).toBe(0);
        expect(member.getMemberName()).toBe("key");
      });
      it("should return a defined key schema even if the map was defined by a numeric sentinel value", () => {
        const map = NormalizedSchema.of((128 satisfies MapSchemaModifier) | (1 satisfies NumericSchema));
        expect(map.getKeySchema().isStringSchema()).toBe(true);
        expect(map.getValueSchema().isNumericSchema()).toBe(true);
      });
      it("map value member", () => {
        const member = ns.getMemberSchema("map").getValueSchema();
        expect(member.isMemberSchema()).toBe(true);
        expect(member.isNumericSchema()).toBe(true);
        expect(member.isStringSchema()).toBe(false);
        expect(member.getSchema()).toBe(1);
        expect(member.getMemberName()).toBe("value");
      });
    });
    describe("struct member", () => {
      it("struct member", () => {
        const member = ns.getMemberSchema("struct");
        expect(member.getName(true)).toBe("ack#Structure");
        expect(member.isMemberSchema()).toBe(true);
        expect(member.isListSchema()).toBe(false);
        expect(member.isMapSchema()).toBe(false);
        expect(member.isStructSchema()).toBe(true);
        expect(member.getMemberName()).toBe("struct");
      });
      it("nested recursion", () => {
        expect(ns.getMemberSchema("struct").isStructSchema()).toBe(true);
        expect(ns.getMemberSchema("struct").getMemberSchema("list").isListSchema()).toBe(true);
        expect(ns.getMemberSchema("struct").getMemberSchema("map").isMapSchema()).toBe(true);
        expect(ns.getMemberSchema("struct").getMemberSchema("struct").isStructSchema()).toBe(true);

        expect(ns.getMemberSchema("struct").getMemberSchema("struct").getMemberSchema("list").getName(true)).toBe(
          ns.getMemberSchema("list").getName(true)
        );
      });
    });
    describe("union member", () => {
      it("is a union and a struct", () => {
        const member = ns.getMemberSchema("union");
        expect(member.getName(true)).toBe("ack#Union");
        expect(member.isMemberSchema()).toBe(true);
        expect(member.isListSchema()).toBe(false);
        expect(member.isMapSchema()).toBe(false);
        expect(member.isStructSchema()).toBe(true);
        expect(member.isUnionSchema()).toBe(true);
        expect(member.getMemberName()).toBe("union");

        expect(member.getMemberSchema("a").isUnitSchema()).toBe(true);
        expect(member.getMemberSchema("b").isStringSchema()).toBe(true);
        expect(member.getMemberSchema("c").isMapSchema()).toBe(true);
      });
    });
  });

  describe("iteration", () => {
    it("iterates over member schemas", () => {
      const iteration = Array.from(ns.structIterator()) as [string, NormalizedSchema][];
      const entries = Object.entries(ns.getMemberSchemas()) as [string, NormalizedSchema][];
      for (let i = 0; i < iteration.length; i++) {
        const [name, schema] = iteration[i];
        const [entryName, entrySchema] = entries[i];
        expect(name).toBe(entryName);
        expect(schema.getMemberName()).toEqual(entrySchema.getMemberName());
        expect(schema.getMergedTraits()).toEqual(entrySchema.getMergedTraits());
      }
    });

    it("can acquire structIterator on the unit schema type and its iteration is empty", () => {
      const iteration = Array.from(NormalizedSchema.of("unit").structIterator());
      expect(iteration.length).toBe(0);
    });
  });

  describe("traits", () => {
    const member: $MemberSchema = [
      [0, "ack", "SimpleString", { idempotencyToken: 1 }, 0] satisfies StaticSimpleSchema,
      0b0000_0001,
    ];
    const container: StaticStructureSchema = [3, "ack", "Container", 0, ["member_name"], [member, 0]];

    const ns = NormalizedSchema.of(container).getMemberSchema("member_name");

    it("has merged traits", () => {
      expect(ns.getMergedTraits()).toEqual({
        idempotencyToken: 1,
        httpLabel: 1,
      });
    });
    it("has member traits if it is a member", () => {
      expect(ns.isMemberSchema()).toBe(true);
      expect(ns.getMemberTraits()).toEqual({
        httpLabel: 1,
      });
    });
    it("has own traits", () => {
      expect(ns.getOwnTraits()).toEqual({
        idempotencyToken: 1,
      });
    });
  });

  describe("idempotency token detection", () => {
    const idempotencyTokenSchemas = [
      NormalizedSchema.of([0, "", "StringWithTraits", 0b0100, 0] satisfies StaticSimpleSchema),
      NormalizedSchema.of([0, "", "StringWithTraits", { idempotencyToken: 1 }, 0] satisfies StaticSimpleSchema),
    ];

    const plainSchemas = [
      NormalizedSchema.of(0),
      NormalizedSchema.of([0, "", "StringWithTraits", 0, 0] satisfies StaticSimpleSchema),
      NormalizedSchema.of([0, "", "StringWithTraits", {}, 0] satisfies StaticSimpleSchema),
    ];

    it("has a consistent shortcut method for idempotencyToken detection", () => {
      for (const schema of idempotencyTokenSchemas) {
        expect(schema.isIdempotencyToken()).toBe(true);
        expect(schema.getMergedTraits().idempotencyToken).toBe(1);
      }

      for (const schema of plainSchemas) {
        expect(schema.isIdempotencyToken()).toBe(false);
        expect(schema.getMergedTraits().idempotencyToken).toBe(undefined);
      }
    });

    it("can understand members with the idempotencyToken trait", () => {
      for (const schema of plainSchemas) {
        expect(schema.isIdempotencyToken()).toBe(false);
        expect(schema.getMergedTraits().idempotencyToken).toBe(undefined);

        const structure = [
          3,
          "",
          "StructureWithIdempotencyTokenMember",
          0,
          ["token"],
          [[() => schema, 0b0100]],
        ] satisfies StaticStructureSchema;
        const ns = NormalizedSchema.of(structure).getMemberSchema("token");

        expect(ns.isIdempotencyToken()).toBe(true);
      }
    });
  });

  describe("event stream detection", () => {
    it("should retrieve the event stream member", () => {
      const schema: StaticStructureSchema = [
        3,
        "ns",
        "StructureWithEventStream",
        0,
        ["A", "B", "C", "D", "EventStream"],
        [0, 0, 0, 0, [3, "ns", "Union", { streaming: 1 }, [], []] satisfies StaticStructureSchema],
      ];
      const ns = NormalizedSchema.of(schema);

      expect(ns.getEventStreamMember()).toEqual("EventStream");
    });

    it("should return empty string if no event stream member is present", () => {
      const schema: StaticStructureSchema = [
        3,
        "ns",
        "StructureWithEventStream",
        0,
        ["A", "B", "C", "D", "EventStream"],
        [0, 0, 0, 0, [3, "ns", "Union", 0, [], []] satisfies StaticStructureSchema],
      ];
      const ns = NormalizedSchema.of(schema);

      expect(ns.getEventStreamMember()).toEqual("");
    });

    it("should not throw an exception if the NormalizedSchema is not a structure", () => {
      const schema = 0;
      const ns = NormalizedSchema.of(schema);

      expect(ns.getEventStreamMember()).toEqual("");
    });
  });

  describe("static schema", () => {
    it("can normalize static schema indifferently to schema class objects", () => {
      const [List, Map, Struct]: [StaticListSchema, StaticMapSchema, () => StaticStructureSchema] = [
        [1, "ack", "List", { sparse: 1 }, 0],
        [2, "ack", "Map", 0, 0, 1],
        () => schema,
      ];
      const schema: StaticStructureSchema = [3, "ack", "Structure", {}, ["list", "map", "struct"], [List, Map, Struct]];

      const ns = NormalizedSchema.of(schema);

      expect(ns.isStructSchema()).toBe(true);
      expect(ns.getMemberSchema("list").isListSchema()).toBe(true);
      expect(ns.getMemberSchema("list").getMergedTraits().sparse).toBe(1);

      expect(ns.getMemberSchema("map").isMapSchema()).toBe(true);
      expect(ns.getMemberSchema("map").getKeySchema().isStringSchema()).toBe(true);
      expect(ns.getMemberSchema("map").getValueSchema().isNumericSchema()).toBe(true);

      expect(ns.getMemberSchema("struct").isStructSchema()).toBe(true);
      expect(ns.getMemberSchema("struct").getMemberSchema("list").isListSchema()).toBe(true);
      expect(ns.getMemberSchema("struct").getMemberSchema("list").getMergedTraits().sparse).toBe(1);
      expect(ns.getMemberSchema("struct").getMemberSchema("map").isMapSchema()).toBe(true);
      expect(ns.getMemberSchema("struct").getMemberSchema("map").getKeySchema().isStringSchema()).toBe(true);
      expect(ns.getMemberSchema("struct").getMemberSchema("map").getValueSchema().isNumericSchema()).toBe(true);
    });
  });

  describe("simple schema wrapper", () => {
    it("should still be able to detect the inner schema type", () => {
      const schema: StaticSimpleSchema = [0, "ack", "String", { unknownTrait: 1 }, 0];

      const ns = NormalizedSchema.of(schema);
      expect(ns.isStringSchema()).toBe(true);
    });
  });
});
