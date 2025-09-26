import type { MemberSchema, StructureSchema } from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import { list } from "./ListSchema";
import { map } from "./MapSchema";
import { NormalizedSchema } from "./NormalizedSchema";
import { SCHEMA } from "./sentinels";
import { sim } from "./SimpleSchema";
import { struct } from "./StructureSchema";

describe(NormalizedSchema.name, () => {
  const [List, Map, Struct] = [list("ack", "List", { sparse: 1 }, 0), map("ack", "Map", 0, 0, 1), () => schema];
  const schema = struct("ack", "Structure", {}, ["list", "map", "struct"], [List, Map, Struct]);

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
    expect(NormalizedSchema.translateTraits(0b0000_0000)).toEqual({});
    expect(NormalizedSchema.translateTraits(0b0000_0001)).toEqual({
      httpLabel: 1,
    });
    expect(NormalizedSchema.translateTraits(0b0000_0011)).toEqual({
      httpLabel: 1,
      idempotent: 1,
    });
    expect(NormalizedSchema.translateTraits(0b0000_0110)).toEqual({
      idempotent: 1,
      idempotencyToken: 1,
    });
    expect(NormalizedSchema.translateTraits(0b0000_1100)).toEqual({
      idempotencyToken: 1,
      sensitive: 1,
    });
    expect(NormalizedSchema.translateTraits(0b0001_1000)).toEqual({
      sensitive: 1,
      httpPayload: 1,
    });
    expect(NormalizedSchema.translateTraits(0b0011_0000)).toEqual({
      httpPayload: 1,
      httpResponseCode: 1,
    });
    expect(NormalizedSchema.translateTraits(0b0110_0000)).toEqual({
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

    it("throws when treating a non-member schema as a member schema", () => {
      expect(() => {
        ns.getMemberName();
      }).toThrow();
    });
  });

  describe("traversal and type identifiers", () => {
    it("type identifiers", () => {
      expect(NormalizedSchema.of("unit").isUnitSchema()).toBe(true);
      expect(NormalizedSchema.of(SCHEMA.LIST_MODIFIER | SCHEMA.NUMERIC).isListSchema()).toBe(true);
      expect(NormalizedSchema.of(SCHEMA.MAP_MODIFIER | SCHEMA.NUMERIC).isMapSchema()).toBe(true);

      expect(NormalizedSchema.of(SCHEMA.DOCUMENT).isDocumentSchema()).toBe(true);

      expect(NormalizedSchema.of(ns.getMemberSchema("struct")).isStructSchema()).toBe(true);
      expect(NormalizedSchema.of(SCHEMA.BLOB).isBlobSchema()).toBe(true);
      expect(NormalizedSchema.of(SCHEMA.TIMESTAMP_DEFAULT).isTimestampSchema()).toBe(true);

      expect(NormalizedSchema.of(SCHEMA.STRING).isStringSchema()).toBe(true);
      expect(NormalizedSchema.of(SCHEMA.BOOLEAN).isBooleanSchema()).toBe(true);
      expect(NormalizedSchema.of(SCHEMA.NUMERIC).isNumericSchema()).toBe(true);
      expect(NormalizedSchema.of(SCHEMA.BIG_INTEGER).isBigIntegerSchema()).toBe(true);
      expect(NormalizedSchema.of(SCHEMA.BIG_DECIMAL).isBigDecimalSchema()).toBe(true);
      expect(NormalizedSchema.of(SCHEMA.STREAMING_BLOB).isStreaming()).toBe(true);

      const structWithStreamingMember = struct(
        "ack",
        "StructWithStreamingMember",
        0,
        ["m"],
        [sim("ns", "blob", SCHEMA.BLOB, { streaming: 1 })]
      );
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
  });

  it("can identify whether a member exists", () => {
    expect(ns.hasMemberSchema("list")).toBe(true);
    expect(ns.hasMemberSchema("map")).toBe(true);
    expect(ns.hasMemberSchema("struct")).toBe(true);
    expect(ns.hasMemberSchema("a")).toBe(false);
    expect(ns.hasMemberSchema("b")).toBe(false);
    expect(ns.hasMemberSchema("c")).toBe(false);
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
    const member: MemberSchema = [sim("ack", "SimpleString", 0, { idempotencyToken: 1 }), 0b0000_0001];
    const container: StructureSchema = struct("ack", "Container", 0, ["member_name"], [member, 0]);

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
      NormalizedSchema.of(sim("", "StringWithTraits", 0, 0b0100)),
      NormalizedSchema.of(sim("", "StringWithTraits", 0, { idempotencyToken: 1 })),
    ];

    const plainSchemas = [
      NormalizedSchema.of(0),
      NormalizedSchema.of(sim("", "StringWithTraits", 0, 0)),
      NormalizedSchema.of(sim("", "StringWithTraits", 0, {})),
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

        const structure = struct("", "StructureWithIdempotencyTokenMember", 0, ["token"], [[() => schema, 0b0100]]);
        const ns = NormalizedSchema.of(structure).getMemberSchema("token");

        expect(ns.isIdempotencyToken()).toBe(true);
      }
    });
  });

  describe("event stream detection", () => {
    it("should retrieve the event stream member", () => {
      const schema = struct(
        "ns",
        "StructureWithEventStream",
        0,
        ["A", "B", "C", "D", "EventStream"],
        [0, 0, 0, 0, struct("ns", "Union", { streaming: 1 }, [], [])]
      );
      const ns = NormalizedSchema.of(schema);

      expect(ns.getEventStreamMember()).toEqual("EventStream");
    });

    it("should return empty string if no event stream member is present", () => {
      const schema = struct(
        "ns",
        "StructureWithEventStream",
        0,
        ["A", "B", "C", "D", "EventStream"],
        [0, 0, 0, 0, struct("ns", "Union", 0, [], [])]
      );
      const ns = NormalizedSchema.of(schema);

      expect(ns.getEventStreamMember()).toEqual("");
    });

    it("should not throw an exception if the NormalizedSchema is not a structure", () => {
      const schema = 0;
      const ns = NormalizedSchema.of(schema);

      expect(ns.getEventStreamMember()).toEqual("");
    });
  });
});
