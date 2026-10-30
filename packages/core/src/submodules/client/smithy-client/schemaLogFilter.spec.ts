import type {
  BooleanSchema,
  NumericSchema,
  StaticSimpleSchema,
  StaticStructureSchema,
  StringSchema,
} from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import { schemaLogFilter } from "./schemaLogFilter";

describe(schemaLogFilter.name, () => {
  const sensitiveString: StaticSimpleSchema = [0, "ns", "SensitiveString", { sensitive: 1 }, 0];

  it("should filter sensitive trait-marked fields", () => {
    const schema: StaticStructureSchema = [
      3,
      "ns",
      "Struct",
      0,
      ["a", "b", "sensitive", "nestedSensitive", "various"],
      [
        0 satisfies StringSchema,
        0 satisfies StringSchema,
        sensitiveString,
        [3, "ns", "NestedSensitiveStruct", 0, ["sensitive"], [sensitiveString]],
        [
          3,
          "ns",
          "Various",
          0,
          ["boolean", "number", "struct", "list-s", "list", "map-s", "map"],
          [
            [0, "ns", "Boolean", { sensitive: 1 }, 2 satisfies BooleanSchema],
            [0, "ns", "Numeric", { sensitive: 1 }, 1 satisfies NumericSchema],
            [3, "ns", "SensitiveStruct", { sensitive: 1 }, [], []],
            [1, "ns", "List", 0, sensitiveString],
            [1, "ns", "List", 0, 0 satisfies StringSchema],
            [2, "ns", "Map", 0, sensitiveString, 0 satisfies StringSchema],
            [2, "ns", "Map", 0, 0 satisfies StringSchema, 0 satisfies StringSchema],
          ],
        ],
      ],
    ];

    expect(
      schemaLogFilter(schema, {
        a: "a",
        b: "b",
        sensitive: "xyz",
        nestedSensitive: {
          sensitive: "xyz",
        },
        various: {
          boolean: false,
          number: 1,
          struct: {
            q: "rf",
          },
          "list-s": [1, 2, 3],
          list: [4, 5, 6],
          "map-s": {
            a: "a",
            b: "b",
            c: "c",
          },
          map: {
            a: "d",
            b: "e",
            c: "f",
          },
        },
      })
    ).toEqual({
      a: "a",
      b: "b",
      sensitive: "***SensitiveInformation***",
      nestedSensitive: {
        sensitive: "***SensitiveInformation***",
      },
      various: {
        boolean: "***SensitiveInformation***",
        number: "***SensitiveInformation***",
        struct: "***SensitiveInformation***",
        "list-s": "***SensitiveInformation***",
        list: [4, 5, 6],
        "map-s": "***SensitiveInformation***",
        map: {
          a: "d",
          b: "e",
          c: "f",
        },
      },
    });
  });

  it("should filter sensitive fields within list and map values", () => {
    const value: StaticStructureSchema = [
      3,
      "ns",
      "Value",
      0,
      ["public", "sensitive"],
      [0 satisfies StringSchema, sensitiveString],
    ];
    const schema: StaticStructureSchema = [
      3,
      "ns",
      "Collections",
      0,
      ["list", "map"],
      [
        [1, "ns", "ValueList", 0, value],
        [2, "ns", "ValueMap", 0, 0 satisfies StringSchema, value],
      ],
    ];

    expect(
      schemaLogFilter(schema, {
        list: [{ public: "visible", sensitive: "secret" }],
        map: { key: { public: "visible", sensitive: "secret" } },
      })
    ).toEqual({
      list: [{ public: "visible", sensitive: "***SensitiveInformation***" }],
      map: { key: { public: "visible", sensitive: "***SensitiveInformation***" } },
    });
  });
});
