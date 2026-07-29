/**
 * Schema-based CBOR codec equivalence test.
 * Exercises all smithy type permutations and verifies v1 ≡ v2.
 */
import { NumericValue } from "@smithy/core/serde";
import type {
  BigDecimalSchema,
  BigIntegerSchema,
  BlobSchema,
  BooleanSchema,
  DocumentSchema,
  NumericSchema,
  StaticListSchema,
  StaticMapSchema,
  StaticStructureSchema,
  StaticUnionSchema,
  TimestampDefaultSchema,
  TimestampEpochSecondsSchema,
  StringSchema,
  UnitSchema,
} from "@smithy/types";
import { describe, expect, it } from "vitest";

import { cbor } from "./cbor";
import { CborShapeDeserializer } from "./codec-v1/CborShapeDeserializer";
import { CborShapeSerializer } from "./codec-v1/CborShapeSerializer";
import { CborShapeDeserializer2 } from "./codec-v2/CborShapeDeserializer2";
import { CborShapeSerializer2 } from "./codec-v2/CborShapeSerializer2";

// ─── Codec instances ─────────────────────────────────────────────────────────

const ser1 = new CborShapeSerializer();
const de1 = new CborShapeDeserializer();
const ser2 = new CborShapeSerializer2();
const de2 = new CborShapeDeserializer2();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const nv = (s: string) => new NumericValue(s, "bigDecimal");

function assertEquivalence(schema: any, value: any): void {
  ser1.write(schema, value);
  const v1Bytes = ser1.flush() as Uint8Array;
  ser2.write(schema, value);
  const v2Bytes = ser2.flush();
  expect(cbor.deserialize(v2Bytes)).toEqual(cbor.deserialize(v1Bytes));

  // Deserialization equivalence from v2-serialized bytes.
  const v1Result = de1.read(schema, v2Bytes);
  const v2Result = de2.read(schema, v2Bytes);
  expect(v2Result).toEqual(v1Result);

  // Round-trip: re-serialize the deserialized output and verify stability
  ser1.write(schema, v1Result);
  const roundTrip1 = ser1.flush() as Uint8Array;
  ser2.write(schema, v1Result);
  const roundTrip2 = ser2.flush();
  expect(cbor.deserialize(roundTrip1)).toEqual(cbor.deserialize(v1Bytes));
  expect(cbor.deserialize(roundTrip2)).toEqual(cbor.deserialize(v1Bytes));
}

function wrap(memberName: string, memberSchema: any, value: any): { schema: StaticStructureSchema; value: any } {
  const schema: StaticStructureSchema = [3, "ns", "Wrapper", 0, [memberName], [memberSchema]];
  return { schema, value: value === undefined ? {} : { [memberName]: value } };
}

function randBytes(len: number): Uint8Array {
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; ++i) {
    buf[i] = (Math.random() * 256) | 0;
  }
  return buf;
}

function randString(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789あいう🎉";
  let s = "";
  for (let i = 0; i < len; ++i) {
    s += chars[(Math.random() * chars.length) | 0];
  }
  return s;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const unitSchema = "unit" satisfies UnitSchema;
const emptyStruct: StaticStructureSchema = [3, "ns", "Empty", 0, [], []];

const unionSchema: StaticUnionSchema = [
  4,
  "ns",
  "MyUnion",
  0,
  ["strVal", "numVal", "boolVal", "unitVal"],
  [0 satisfies StringSchema, 1 satisfies NumericSchema, 2 satisfies BooleanSchema, "unit" satisfies UnitSchema],
];

const allTypesSchema: StaticStructureSchema = [
  3,
  "ns",
  "AllTypes",
  0,
  [
    "blob",
    "bool",
    "str",
    "num",
    "bigInt",
    "bigDec",
    "ts",
    "doc",
    "listStr",
    "listNum",
    "sparseList",
    "mapStr",
    "mapNum",
    "sparseMap",
    "union",
    "nested",
  ],
  [
    21 satisfies BlobSchema,
    2 satisfies BooleanSchema,
    0 satisfies StringSchema,
    1 satisfies NumericSchema,
    17 satisfies BigIntegerSchema,
    19 satisfies BigDecimalSchema,
    4 satisfies TimestampDefaultSchema,
    15 satisfies DocumentSchema,
    [1, "ns", "LS", 0, 0] satisfies StaticListSchema,
    [1, "ns", "LN", 0, 1] satisfies StaticListSchema,
    [1, "ns", "SL", { sparse: 1 }, 0] satisfies StaticListSchema,
    [2, "ns", "MS", 0, 0, 0] satisfies StaticMapSchema,
    [2, "ns", "MN", 0, 0, 1] satisfies StaticMapSchema,
    [2, "ns", "SM", { sparse: 1 }, 0, 0] satisfies StaticMapSchema,
    unionSchema,
    (() => allTypesSchema) as any,
  ],
];

// ─── Pre-generated test values ───────────────────────────────────────────────

const BLOB_3 = randBytes(3);
const BLOB_256 = randBytes(256);
const STR_1 = randString(1);
const STR_10 = randString(10);
const STR_50 = randString(50);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("CBOR v2 codec equivalence: schema-based permutations", () => {
  describe("unit schema", () => {
    it("serializes unit", () => {
      assertEquivalence(unitSchema, {});
    });
  });

  describe("empty struct", () => {
    it("serializes empty struct", () => {
      assertEquivalence(emptyStruct, {});
    });
  });

  describe("blob member", () => {
    const cases: Array<[string, any]> = [
      ["absent", undefined],
      ["empty", new Uint8Array(0)],
      ["3 bytes", BLOB_3],
      ["256 bytes", BLOB_256],
    ];
    it.each(cases)("%s", (_, value) => {
      const { schema, value: v } = wrap("blob", 21 satisfies BlobSchema, value);
      assertEquivalence(schema, v);
    });
  });

  describe("boolean member", () => {
    const cases: Array<[string, any]> = [
      ["absent", undefined],
      ["false", false],
      ["true", true],
    ];
    it.each(cases)("%s", (_, value) => {
      const { schema, value: v } = wrap("bool", 2 satisfies BooleanSchema, value);
      assertEquivalence(schema, v);
    });
  });

  describe("string member", () => {
    const cases: Array<[string, any]> = [
      ["absent", undefined],
      ["empty", ""],
      ["1 char", STR_1],
      ["10 chars", STR_10],
      ["50 chars", STR_50],
    ];
    it.each(cases)("%s", (_, value) => {
      const { schema, value: v } = wrap("str", 0 satisfies StringSchema, value);
      assertEquivalence(schema, v);
    });
  });

  describe("numeric members (byte/short/int/long/float/double)", () => {
    const intCases: Array<[string, number | bigint]> = [
      // byte range
      ["byte: -130", -130],
      ["byte: -128", -128],
      ["byte: -1", -1],
      ["byte: 0", 0],
      ["byte: 1", 1],
      ["byte: 127", 127],
      ["byte: 128", 128],
      ["byte: 130", 130],
      // short range
      ["short: -33000", -33000],
      ["short: -32768", -32768],
      ["short: 32767", 32767],
      ["short: 33000", 33000],
      // integer range
      ["int: -2147483649", -2147483649],
      ["int: -2147483648", -2147483648],
      ["int: 2147483647", 2147483647],
      ["int: 2147483648", 2147483648],
      // long range (number)
      ["long: -9007199254740991", Number.MIN_SAFE_INTEGER],
      ["long: 9007199254740991", Number.MAX_SAFE_INTEGER],
      // long range (bigint)
      ["long: BigInt(-9223372036854775808)", BigInt("-9223372036854775808")],
      ["long: BigInt(-1)", BigInt(-1)],
      ["long: BigInt(0)", BigInt(0)],
      ["long: BigInt(1)", BigInt(1)],
      ["long: BigInt(9223372036854775807)", BigInt("9223372036854775807")],
    ];

    const floatCases: Array<[string, number]> = [
      ["float: -1.5", -1.5],
      ["float: -0.1", -0.1],
      ["float: 0.1", 0.1],
      ["float: 1.5", 1.5],
      ["float: 3.14159", 3.14159],
      ["float: 1e10", 1e10],
      ["float: -1e10", -1e10],
      ["float: 1e38", 1e38],
      ["float: -1e38", -1e38],
    ];

    it.each(intCases)("%s", (_, value) => {
      const { schema, value: v } = wrap("num", 1 satisfies NumericSchema, value);
      assertEquivalence(schema, v);
    });

    it.each(floatCases)("%s", (_, value) => {
      const { schema, value: v } = wrap("num", 1 satisfies NumericSchema, value);
      assertEquivalence(schema, v);
    });

    it("absent", () => {
      const { schema, value: v } = wrap("num", 1 satisfies NumericSchema, undefined);
      assertEquivalence(schema, v);
    });
  });

  describe("bigInteger member", () => {
    const cases: Array<[string, any]> = [
      ["absent", undefined],
      ["large negative", BigInt("-99999999999999999999")],
      ["-1", BigInt(-1)],
      ["0", BigInt(0)],
      ["1", BigInt(1)],
      ["large positive", BigInt("99999999999999999999")],
    ];
    it.each(cases)("%s", (_, value) => {
      const { schema, value: v } = wrap("bigInt", 17 satisfies BigIntegerSchema, value);
      assertEquivalence(schema, v);
    });
  });

  describe("bigDecimal member", () => {
    const cases: Array<[string, any]> = [
      ["absent", undefined],
      ["large negative decimal", nv("-9999999999.999")],
      ["-1", nv("-1")],
      ["-0.001", nv("-0.001")],
      ["0", nv("0")],
      ["0.001", nv("0.001")],
      ["1", nv("1")],
      ["large positive decimal", nv("9999999999.999")],
    ];
    it.each(cases)("%s", (_, value) => {
      const { schema, value: v } = wrap("bigDec", 19 satisfies BigDecimalSchema, value);
      assertEquivalence(schema, v);
    });
  });

  describe("timestamp member", () => {
    const cases: Array<[string, any]> = [
      ["absent", undefined],
      ["epoch 0", new Date(0)],
      ["1999-12-31", new Date("1999-12-31T23:59:59.999Z")],
      ["2050-06-15", new Date("2050-06-15T12:00:00.000Z")],
    ];
    it.each(cases)("%s", (_, value) => {
      const { schema, value: v } = wrap("ts", 4 satisfies TimestampDefaultSchema, value);
      assertEquivalence(schema, v);
    });

    it.each(cases)("epoch-seconds: %s", (_, value) => {
      const { schema, value: v } = wrap("ts", 7 satisfies TimestampEpochSecondsSchema, value);
      assertEquivalence(schema, v);
    });
  });

  describe("document member", () => {
    const cases: Array<[string, any]> = [
      ["absent", undefined],
      [
        "complex document",
        {
          bool: true,
          str: "hello",
          num: 42,
          nil: null,
          list: [1, "two", null],
          map: { a: 1, b: "two" },
        },
      ],
    ];
    it.each(cases)("%s", (_, value) => {
      const { schema, value: v } = wrap("doc", 15 satisfies DocumentSchema, value);
      assertEquivalence(schema, v);
    });
  });

  describe("list members", () => {
    describe("list of strings", () => {
      const listSchema: StaticListSchema = [1, "ns", "LS", 0, 0];
      const cases: Array<[string, any]> = [
        ["absent", undefined],
        ["empty", []],
        ["3 items", ["alpha", "beta", "gamma"]],
      ];
      it.each(cases)("%s", (_, value) => {
        const { schema, value: v } = wrap("listStr", listSchema, value);
        assertEquivalence(schema, v);
      });
    });

    describe("list of numbers", () => {
      const listSchema: StaticListSchema = [1, "ns", "LN", 0, 1];
      const cases: Array<[string, any]> = [
        ["absent", undefined],
        ["empty", []],
        ["3 items", [1, -2.5, 9007199254740991]],
      ];
      it.each(cases)("%s", (_, value) => {
        const { schema, value: v } = wrap("listNum", listSchema, value);
        assertEquivalence(schema, v);
      });
    });

    describe("list of structs (recursive)", () => {
      const innerStruct: StaticStructureSchema = [3, "ns", "Inner", 0, ["name", "val"], [0, 1]];
      const listSchema: StaticListSchema = [1, "ns", "LStruct", 0, innerStruct];
      const cases: Array<[string, any]> = [
        ["absent", undefined],
        ["empty", []],
        ["3 items", [{ name: "a", val: 1 }, { name: "b" }, { val: 99 }]],
      ];
      it.each(cases)("%s", (_, value) => {
        const { schema, value: v } = wrap("listStruct", listSchema, value);
        assertEquivalence(schema, v);
      });
    });
  });

  describe("sparse list member", () => {
    const sparseListSchema = [1, "ns", "SL", { sparse: 1 }, 0] satisfies StaticListSchema;
    const cases: Array<[string, any]> = [
      ["absent", undefined],
      ["empty", []],
      ["with nulls", ["hello", null, "world"]],
    ];
    it.each(cases)("%s", (_, value) => {
      const { schema, value: v } = wrap("sparseList", sparseListSchema, value);
      assertEquivalence(schema, v);
    });
  });

  describe("map members", () => {
    describe("map string→string", () => {
      const mapSchema: StaticMapSchema = [2, "ns", "MS", 0, 0, 0];
      const cases: Array<[string, any]> = [
        ["absent", undefined],
        ["empty", {}],
        ["3 kv pairs", { alpha: "one", beta: "two", gamma: "three" }],
      ];
      it.each(cases)("%s", (_, value) => {
        const { schema, value: v } = wrap("mapStr", mapSchema, value);
        assertEquivalence(schema, v);
      });
    });

    describe("map string→number", () => {
      const mapSchema: StaticMapSchema = [2, "ns", "MN", 0, 0, 1];
      const cases: Array<[string, any]> = [
        ["absent", undefined],
        ["empty", {}],
        ["3 kv pairs", { x: 0, y: -1.5, z: 9007199254740991 }],
      ];
      it.each(cases)("%s", (_, value) => {
        const { schema, value: v } = wrap("mapNum", mapSchema, value);
        assertEquivalence(schema, v);
      });
    });
  });

  describe("sparse map member", () => {
    const sparseMapSchema = [2, "ns", "SM", { sparse: 1 }, 0, 0] satisfies StaticMapSchema;
    const cases: Array<[string, any]> = [
      ["absent", undefined],
      ["empty", {}],
      ["with null value", { a: "hello", b: null, c: "world" }],
    ];
    it.each(cases)("%s", (_, value) => {
      const { schema, value: v } = wrap("sparseMap", sparseMapSchema, value);
      assertEquivalence(schema, v);
    });
  });

  describe("union member", () => {
    const structWithUnion: StaticStructureSchema = [3, "ns", "S", 0, ["union"], [unionSchema]];

    const cases: Array<[string, any]> = [
      ["absent", {}],
      ["strVal variant", { union: { strVal: "hello" } }],
      ["numVal variant", { union: { numVal: 42 } }],
      ["boolVal variant", { union: { boolVal: true } }],
      ["unitVal variant", { union: { unitVal: {} } }],
    ];

    it.each(cases)("%s", (_, value) => {
      assertEquivalence(structWithUnion, value);
    });

    it("unknown key without __type (union $unknown)", () => {
      // Unknown union members are deserialized to $unknown.
      const bytes = cbor.serialize({ union: { unknownTag: "surprise" } });
      const v1Result = de1.read(structWithUnion, bytes);
      const v2Result = de2.read(structWithUnion, bytes);
      expect(v2Result).toEqual(v1Result);
    });

    it("unknown key with __type", () => {
      const bytes = cbor.serialize({ union: { __type: "ns.MyUnion", unknownTag: "surprise" } });
      const v1Result = de1.read(structWithUnion, bytes);
      const v2Result = de2.read(structWithUnion, bytes);
      expect(v2Result).toEqual(v1Result);
    });
  });

  describe("nested struct member", () => {
    const cases: Array<[string, any]> = [
      ["absent", {}],
      ["empty nested", { nested: {} }],
      ["nested with members", { nested: { str: "inner", num: 7, bool: true } }],
      ["deeply nested", { nested: { nested: { str: "deep", num: -1 } } }],
    ];

    it.each(cases)("%s", (_, value) => {
      assertEquivalence(allTypesSchema, value);
    });
  });

  describe("struct with __type (error backward compat)", () => {
    it("__type with extra unknown keys passes through", () => {
      const schema: StaticStructureSchema = [3, "ns", "AB", 0, ["a", "b"], [0, 1]];
      const bytes = cbor.serialize({
        __type: "ns#Other",
        __field__: "xyz",
        extra: 123,
        a: "known",
        b: 42,
      });
      const v1Result = de1.read(schema, bytes);
      const v2Result = de2.read(schema, bytes);
      expect(v2Result).toEqual(v1Result);
    });

    it("struct without __type drops unknown keys", () => {
      const schema: StaticStructureSchema = [3, "ns", "AB", 0, ["a", "b"], [0, 1]];
      const bytes = cbor.serialize({
        unknownField: "dropped",
        a: "kept",
        b: 99,
      });
      const v1Result = de1.read(schema, bytes);
      const v2Result = de2.read(schema, bytes);
      expect(v2Result).toEqual(v1Result);
    });
  });

  describe("combined members", () => {
    it("multiple members populated", () => {
      assertEquivalence(allTypesSchema, {
        blob: BLOB_3,
        bool: true,
        str: "hello world",
        num: 42,
        bigInt: BigInt("123456789012345678"),
        bigDec: nv("3.14159"),
        ts: new Date("2025-01-01T00:00:00.000Z"),
        listStr: ["a", "b", "c"],
        listNum: [1, 2, 3],
        mapStr: { key1: "val1", key2: "val2" },
        mapNum: { x: 10, y: 20 },
        union: { strVal: "tagged" },
        nested: { str: "inner", num: -1 },
      });
    });

    it("all members absent", () => {
      assertEquivalence(allTypesSchema, {});
    });

    it("sparse collections with nulls", () => {
      assertEquivalence(allTypesSchema, {
        sparseList: ["one", null, "three"],
        sparseMap: { a: "val", b: null },
      });
    });
  });
});
