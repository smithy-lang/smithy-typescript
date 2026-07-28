import fc from "fast-check";
import { NumericValue } from "@smithy/core/serde";
import type {
  BigDecimalSchema,
  BigIntegerSchema,
  BlobSchema,
  BooleanSchema,
  NumericSchema,
  StaticListSchema,
  StaticStructureSchema,
  StaticUnionSchema,
  StringSchema,
  TimestampDefaultSchema,
  TimestampEpochSecondsSchema,
} from "@smithy/types";
import { describe, expect, it } from "vitest";

import { cbor } from "./cbor";
import { CborShapeDeserializer } from "./codec-v1/CborShapeDeserializer";
import { CborShapeSerializer } from "./codec-v1/CborShapeSerializer";
import { CborShapeDeserializer2 } from "./codec-v2/CborShapeDeserializer2";
import { CborShapeSerializer2 } from "./codec-v2/CborShapeSerializer2";

// ─── Reference (multi-pass) and candidate (single-pass) implementations ─────

const refSerializer = new CborShapeSerializer();
const refDeserializer = new CborShapeDeserializer();
const singlePassSer = new CborShapeSerializer2();
const singlePassDe = new CborShapeDeserializer2();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function serializeRef(schema: any, data: unknown): Uint8Array {
  refSerializer.write(schema, data);
  return refSerializer.flush() as Uint8Array;
}

function serializeSinglePass(schema: any, data: unknown): Uint8Array {
  singlePassSer.write(schema, data);
  return singlePassSer.flush() as Uint8Array;
}

function deserializeRef(schema: any, bytes: Uint8Array): unknown {
  return refDeserializer.read(schema, bytes);
}

function deserializeSinglePass(schema: any, bytes: Uint8Array): unknown {
  return singlePassDe.read(schema, bytes);
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const stringMapSchema = [3, "", "S", 0, ["tags"], [[2, "", "Map", 0, 0, 0]]] satisfies StaticStructureSchema;

const numericMapSchema = [3, "", "S", 0, ["values"], [[2, "", "Map", 0, 0, 1]]] satisfies StaticStructureSchema;

const listOfStringsSchema = [
  3,
  "",
  "S",
  0,
  ["items"],
  [[[1, "", "List", 0, 0] satisfies StaticListSchema, 0]],
] satisfies StaticStructureSchema;

const listOfNumbersSchema = [
  3,
  "",
  "S",
  0,
  ["items"],
  [[[1, "", "List", 0, 1] satisfies StaticListSchema, 0]],
] satisfies StaticStructureSchema;

const blobSchema = [3, "", "S", 0, ["data"], [21 satisfies BlobSchema]] satisfies StaticStructureSchema;

const timestampSchema = [3, "", "S", 0, ["ts"], [4 satisfies TimestampDefaultSchema]] satisfies StaticStructureSchema;

const bigNumberSchema = [
  3,
  "",
  "S",
  0,
  ["bigint", "bigdecimal"],
  [17 satisfies BigIntegerSchema, 19 satisfies BigDecimalSchema],
] satisfies StaticStructureSchema;

const nestingStruct: StaticStructureSchema = [
  3,
  "ns",
  "Nested",
  0,
  ["str", "num", "bool", "list", "map", "nested"],
  [
    0 satisfies StringSchema,
    1 satisfies NumericSchema,
    2 satisfies BooleanSchema,
    64 | 1,
    128 | 0,
    () => nestingStruct,
  ],
];

const unionSchema = [
  4,
  "ns",
  "MyUnion",
  0,
  ["strVal", "numVal", "boolVal"],
  [0 satisfies StringSchema, 1 satisfies NumericSchema, 2 satisfies BooleanSchema],
] satisfies StaticUnionSchema;

const structWithUnion = [3, "ns", "S", 0, ["union"], [unionSchema]] satisfies StaticStructureSchema;

const allTypesSchema: StaticStructureSchema = [
  3,
  "ns",
  "AllTypes",
  0,
  ["str", "num", "bool", "blob", "ts", "bigint", "list", "map", "nested"],
  [
    0 satisfies StringSchema,
    1 satisfies NumericSchema,
    2 satisfies BooleanSchema,
    21 satisfies BlobSchema,
    7 satisfies TimestampEpochSecondsSchema,
    17 satisfies BigIntegerSchema,
    [1, "", "List", 0, 0] satisfies StaticListSchema,
    [2, "", "Map", 0, 0, 0],
    () => allTypesSchema,
  ],
];

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** String with varied characters including non-ASCII and multi-byte. */
const arbString = fc.oneof(
  fc.string({ minLength: 0, maxLength: 100 }),
  fc.string({
    unit: fc.oneof(
      fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz 0123456789".split("")),
      fc.constantFrom("\u00e9", "\u2603", "\ud83d\ude00", "\u3042", "\u0001", "\u001f")
    ),
    minLength: 0,
    maxLength: 50,
  }),
  fc.string({
    unit: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789-_.".split("")),
    minLength: 0,
    maxLength: 50,
  })
);

const mapKey = fc
  .oneof(
    fc.string({ minLength: 1, maxLength: 30 }),
    fc.string({
      unit: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789".split("")),
      minLength: 1,
      maxLength: 20,
    })
  )
  .filter((k) => k !== "__proto__");

const arbNumber = fc.oneof(
  fc.integer(),
  fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e15, max: 1e15 }),
  fc.constantFrom(0, -0, 1, -1, 0.1, -0.1, 1e10, -1e10)
);

const stringMap = fc.dictionary(mapKey, arbString, { minKeys: 0, maxKeys: 50 });
const numericMap = fc.dictionary(mapKey, arbNumber, { minKeys: 0, maxKeys: 50 });
const blob = fc.uint8Array({ minLength: 0, maxLength: 512 });
const timestamp = fc
  .date({ min: new Date("1970-01-01"), max: new Date("2100-01-01") })
  .filter((d) => !isNaN(d.getTime()));
const bigint = fc.bigInt({
  min: BigInt("-10000000000000000000000000000"),
  max: BigInt("10000000000000000000000000000"),
});

const nestedStruct: fc.Arbitrary<any> = fc.letrec((tie) => ({
  struct: fc.record(
    {
      str: fc.option(arbString, { nil: undefined }),
      num: fc.option(arbNumber, { nil: undefined }),
      bool: fc.option(fc.boolean(), { nil: undefined }),
      list: fc.option(fc.array(arbNumber, { minLength: 0, maxLength: 10 }), { nil: undefined }),
      map: fc.option(fc.dictionary(mapKey, arbString, { minKeys: 0, maxKeys: 5 }), { nil: undefined }),
      nested: fc.option(tie("struct") as fc.Arbitrary<any>, { nil: undefined, depthSize: "small" }),
    },
    { requiredKeys: [] }
  ),
})).struct;

const allTypesData: fc.Arbitrary<any> = fc.letrec((tie) => ({
  data: fc.record(
    {
      str: fc.option(arbString, { nil: undefined }),
      num: fc.option(arbNumber, { nil: undefined }),
      bool: fc.option(fc.boolean(), { nil: undefined }),
      blob: fc.option(blob, { nil: undefined }),
      ts: fc.option(timestamp, { nil: undefined }),
      bigint: fc.option(bigint, { nil: undefined }),
      list: fc.option(fc.array(arbString, { minLength: 0, maxLength: 10 }), { nil: undefined }),
      map: fc.option(fc.dictionary(mapKey, arbString, { minKeys: 0, maxKeys: 5 }), { nil: undefined }),
      nested: fc.option(tie("data") as fc.Arbitrary<any>, { nil: undefined, depthSize: "small" }),
    },
    { requiredKeys: [] }
  ),
})).data;

// ─── Fuzz Tests ──────────────────────────────────────────────────────────────

describe("CBOR serde fuzz: SinglePass matches MultiPass", () => {
  describe("Serializer: CborShapeSerializer2 matches CborShapeSerializer", () => {
    it("string maps", { timeout: 30_000 }, () => {
      fc.assert(
        fc.property(stringMap, (tags) => {
          const ref = serializeRef(stringMapSchema, { tags });
          const exp = serializeSinglePass(stringMapSchema, { tags });
          expect(cbor.deserialize(exp)).toEqual(cbor.deserialize(ref));
        }),
        { numRuns: 10_000 }
      );
    });

    it("numeric maps", { timeout: 30_000 }, () => {
      fc.assert(
        fc.property(numericMap, (values) => {
          const ref = serializeRef(numericMapSchema, { values });
          const exp = serializeSinglePass(numericMapSchema, { values });
          expect(cbor.deserialize(exp)).toEqual(cbor.deserialize(ref));
        }),
        { numRuns: 10_000 }
      );
    });

    it("lists of strings", { timeout: 30_000 }, () => {
      fc.assert(
        fc.property(fc.array(arbString, { minLength: 0, maxLength: 50 }), (items) => {
          const ref = serializeRef(listOfStringsSchema, { items });
          const exp = serializeSinglePass(listOfStringsSchema, { items });
          expect(cbor.deserialize(exp)).toEqual(cbor.deserialize(ref));
        }),
        { numRuns: 10_000 }
      );
    });

    it("lists of numbers", { timeout: 30_000 }, () => {
      fc.assert(
        fc.property(fc.array(arbNumber, { minLength: 0, maxLength: 50 }), (items) => {
          const ref = serializeRef(listOfNumbersSchema, { items });
          const exp = serializeSinglePass(listOfNumbersSchema, { items });
          expect(cbor.deserialize(exp)).toEqual(cbor.deserialize(ref));
        }),
        { numRuns: 10_000 }
      );
    });

    it("blobs", { timeout: 30_000 }, () => {
      fc.assert(
        fc.property(blob, (data) => {
          const ref = serializeRef(blobSchema, { data });
          const exp = serializeSinglePass(blobSchema, { data });
          expect(cbor.deserialize(exp)).toEqual(cbor.deserialize(ref));
        }),
        { numRuns: 5_000 }
      );
    });

    it("timestamps", { timeout: 30_000 }, () => {
      fc.assert(
        fc.property(timestamp, (ts) => {
          const data = { ts };
          const ref = serializeRef(timestampSchema, data);
          const exp = serializeSinglePass(timestampSchema, data);
          expect(cbor.deserialize(exp)).toEqual(cbor.deserialize(ref));
        }),
        { numRuns: 10_000 }
      );
    });

    it("bigints and bigdecimals", { timeout: 30_000 }, () => {
      fc.assert(
        fc.property(bigint, (bi) => {
          const data = {
            bigint: bi,
            bigdecimal: new NumericValue(`${bi}.${Math.abs(Number(bi % BigInt(1000)))}`, "bigDecimal"),
          };
          const ref = serializeRef(bigNumberSchema, data);
          const exp = serializeSinglePass(bigNumberSchema, data);
          expect(cbor.deserialize(exp)).toEqual(cbor.deserialize(ref));
        }),
        { numRuns: 5_000 }
      );
    });

    it("nested structs", { timeout: 30_000 }, () => {
      fc.assert(
        fc.property(nestedStruct, (data) => {
          const ref = serializeRef(nestingStruct, data);
          const exp = serializeSinglePass(nestingStruct, data);
          expect(cbor.deserialize(exp)).toEqual(cbor.deserialize(ref));
        }),
        { numRuns: 10_000 }
      );
    });

    it("all types combined", { timeout: 60_000 }, () => {
      fc.assert(
        fc.property(allTypesData, (data) => {
          const ref = serializeRef(allTypesSchema, data);
          const exp = serializeSinglePass(allTypesSchema, data);
          expect(cbor.deserialize(exp)).toEqual(cbor.deserialize(ref));
        }),
        { numRuns: 10_000 }
      );
    });

    it("unions", { timeout: 30_000 }, () => {
      const unionData = fc.oneof(
        arbString.map((s) => ({ union: { strVal: s } })),
        arbNumber.map((n) => ({ union: { numVal: n } })),
        fc.boolean().map((b) => ({ union: { boolVal: b } }))
      );
      fc.assert(
        fc.property(unionData, (data) => {
          const ref = serializeRef(structWithUnion, data);
          const exp = serializeSinglePass(structWithUnion, data);
          expect(cbor.deserialize(exp)).toEqual(cbor.deserialize(ref));
        }),
        { numRuns: 10_000 }
      );
    });
  });

  describe("Deserializer: CborShapeDeserializer2 matches CborShapeDeserializer", () => {
    it("string maps", { timeout: 30_000 }, () => {
      fc.assert(
        fc.property(stringMap, (tags) => {
          const bytes = serializeSinglePass(stringMapSchema, { tags });
          const ref = deserializeRef(stringMapSchema, bytes);
          const exp = deserializeSinglePass(stringMapSchema, bytes);
          expect(exp).toEqual(ref);
        }),
        { numRuns: 10_000 }
      );
    });

    it("numeric maps", { timeout: 30_000 }, () => {
      fc.assert(
        fc.property(numericMap, (values) => {
          const bytes = serializeSinglePass(numericMapSchema, { values });
          const ref = deserializeRef(numericMapSchema, bytes);
          const exp = deserializeSinglePass(numericMapSchema, bytes);
          expect(exp).toEqual(ref);
        }),
        { numRuns: 10_000 }
      );
    });

    it("blobs", { timeout: 30_000 }, () => {
      fc.assert(
        fc.property(blob, (data) => {
          const bytes = serializeSinglePass(blobSchema, { data });
          const ref = deserializeRef(blobSchema, bytes);
          const exp = deserializeSinglePass(blobSchema, bytes);
          expect(exp).toEqual(ref);
        }),
        { numRuns: 5_000 }
      );
    });

    it("timestamps", { timeout: 30_000 }, () => {
      fc.assert(
        fc.property(timestamp, (ts) => {
          const bytes = serializeSinglePass(timestampSchema, { ts });
          const ref = deserializeRef(timestampSchema, bytes);
          const exp = deserializeSinglePass(timestampSchema, bytes);
          expect(exp).toEqual(ref);
        }),
        { numRuns: 10_000 }
      );
    });

    it("nested structs", { timeout: 30_000 }, () => {
      fc.assert(
        fc.property(nestedStruct, (data) => {
          const bytes = serializeSinglePass(nestingStruct, data);
          const ref = deserializeRef(nestingStruct, bytes);
          const exp = deserializeSinglePass(nestingStruct, bytes);
          expect(exp).toEqual(ref);
        }),
        { numRuns: 10_000 }
      );
    });

    it("all types combined", { timeout: 60_000 }, () => {
      fc.assert(
        fc.property(allTypesData, (data) => {
          const bytes = serializeSinglePass(allTypesSchema, data);
          const ref = deserializeRef(allTypesSchema, bytes);
          const exp = deserializeSinglePass(allTypesSchema, bytes);
          expect(exp).toEqual(ref);
        }),
        { numRuns: 10_000 }
      );
    });

    it("unions", { timeout: 30_000 }, () => {
      const unionData = fc.oneof(
        arbString.map((s) => ({ union: { strVal: s } })),
        arbNumber.map((n) => ({ union: { numVal: n } })),
        fc.boolean().map((b) => ({ union: { boolVal: b } }))
      );
      fc.assert(
        fc.property(unionData, (data) => {
          const bytes = serializeSinglePass(structWithUnion, data);
          const ref = deserializeRef(structWithUnion, bytes);
          const exp = deserializeSinglePass(structWithUnion, bytes);
          expect(exp).toEqual(ref);
        }),
        { numRuns: 10_000 }
      );
    });
  });

  describe("Round-trip: single-pass serialize → single-pass deserialize", () => {
    it("string maps survive round-trip", { timeout: 30_000 }, () => {
      fc.assert(
        fc.property(stringMap, (tags) => {
          const input = { tags };
          const bytes = serializeSinglePass(stringMapSchema, input);
          const output = deserializeSinglePass(stringMapSchema, bytes);
          expect(output).toEqual(input);
        }),
        { numRuns: 10_000 }
      );
    });

    it("nested structs survive round-trip", { timeout: 30_000 }, () => {
      fc.assert(
        fc.property(nestedStruct, (data) => {
          const bytes = serializeSinglePass(nestingStruct, data);
          // Normalize through ref to handle undefined → omitted keys
          const expected = deserializeRef(nestingStruct, bytes);
          const actual = deserializeSinglePass(nestingStruct, bytes);
          expect(actual).toEqual(expected);
        }),
        { numRuns: 10_000 }
      );
    });

    it("all types survive round-trip", { timeout: 60_000 }, () => {
      fc.assert(
        fc.property(allTypesData, (data) => {
          const bytes = serializeSinglePass(allTypesSchema, data);
          const expected = deserializeRef(allTypesSchema, bytes);
          const actual = deserializeSinglePass(allTypesSchema, bytes);
          expect(actual).toEqual(expected);
        }),
        { numRuns: 10_000 }
      );
    });
  });

  describe("Serializer: should never crash on arbitrary inputs", () => {
    it("single-pass serializer handles arbitrary nested data without crashing", { timeout: 30_000 }, () => {
      fc.assert(
        fc.property(nestedStruct, (data) => {
          singlePassSer.write(nestingStruct, data);
          const result = singlePassSer.flush();
          expect(result).toBeInstanceOf(Uint8Array);
          expect(result.byteLength).toBeGreaterThan(0);
        }),
        { numRuns: 10_000 }
      );
    });
  });

  describe("Deserializer: should never crash on valid CBOR", () => {
    it("single-pass deserializer handles arbitrary valid CBOR without crashing", { timeout: 30_000 }, () => {
      fc.assert(
        fc.property(nestedStruct, (data) => {
          const bytes = serializeRef(nestingStruct, data);
          const result = deserializeSinglePass(nestingStruct, bytes);
          expect(result).toBeDefined();
        }),
        { numRuns: 10_000 }
      );
    });
  });
});
