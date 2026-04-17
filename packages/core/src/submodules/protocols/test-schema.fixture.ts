import type {
  BigDecimalSchema,
  BigIntegerSchema,
  BlobSchema,
  NumericSchema,
  StaticStructureSchema,
  StaticUnionSchema,
  StringSchema,
  TimestampEpochSecondsSchema,
} from "@smithy/types";

/**
 * Test schema for a widget with various member types.
 */
export const widget: StaticStructureSchema = [
  3,
  "ns",
  "Widget",
  0,
  [
    "blob",
    "list",
    "sparseList",
    "map",
    "sparseMap",
    "media",
    "timestamp",
    "bigint",
    "bigdecimal",
    "scalar",
  ],
  [
    21 satisfies BlobSchema,
    () => [1, "ns", "StringList", {}, 0 satisfies StringSchema],
    () => [1, "ns", "SparseStringList", { sparse: 1 }, 0 satisfies StringSchema],
    () => [2, "ns", "StringMap", {}, 0 satisfies StringSchema, 0 satisfies StringSchema],
    () => [2, "ns", "SparseStringMap", { sparse: 1 }, 0 satisfies StringSchema, 0 satisfies StringSchema],
    [0, "ns", "MediaString", { mediaType: "application/json" }, 0 satisfies StringSchema],
    7 satisfies TimestampEpochSecondsSchema,
    17 satisfies BigIntegerSchema,
    19 satisfies BigDecimalSchema,
    1 satisfies NumericSchema,
  ],
];

const unionSchema: StaticUnionSchema = [
  4,
  "ns",
  "MyUnion",
  0,
  ["timestamp", "blob"],
  [7 satisfies TimestampEpochSecondsSchema, 21 satisfies BlobSchema],
];

/**
 * Struct containing a union member (tracks $unknown).
 */
export const unionStruct: StaticStructureSchema = [
  3,
  "ns",
  "UnionStruct",
  0,
  ["union"],
  [() => unionSchema],
];

/**
 * Control: struct containing a non-union struct member (does not track $unknown).
 */
const nonUnionSchema: StaticStructureSchema = [
  3,
  "ns",
  "MyUnion",
  0,
  ["timestamp", "blob"],
  [7 satisfies TimestampEpochSecondsSchema, 21 satisfies BlobSchema],
];

export const unionStructControl: StaticStructureSchema = [
  3,
  "ns",
  "UnionStructControl",
  0,
  ["union"],
  [() => nonUnionSchema],
];

/**
 * Schema with nesting for performance tests.
 */
export const nestingWidget: StaticStructureSchema = [
  3,
  "ns",
  "NestingWidget",
  0,
  ["blob", "nested", "list"],
  [
    21 satisfies BlobSchema,
    () => nestingWidget,
    () => [1, "ns", "NestingWidgetList", {}, () => nestingWidget],
  ],
];

/**
 * Creates a nested widget object of configurable depth for performance testing.
 */
export function createNestingWidget(depth: number): Record<string, any> {
  const obj: Record<string, any> = {
    blob: new Uint8Array([0, 1, 2, 3]),
  };
  if (depth > 1) {
    obj.nested = createNestingWidget(depth - 1);
    obj.list = [{ blob: new Uint8Array([0, 1, 2, 3]) }];
  }
  return obj;
}
