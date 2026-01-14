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
  TimestampEpochSecondsSchema,
} from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import { validateSchema } from "./validateSchema";

describe("schema-based runtime typecheck", () => {
  const Widget$: StaticStructureSchema = [
    3,
    "ns",
    "Widget",
    0,
    [
      "string",
      "n",
      "bool",
      "media",
      "timestamp",
      "document",
      "bigint",
      "bigdecimal",
      "blob",

      "list",
      "sparseList",
      "map",
      "sparseMap",

      "widget",
    ],
    [
      0,
      1 satisfies NumericSchema,
      2 satisfies BooleanSchema,
      [0, "ns", "Media", { mediaType: "application/json" }, 0],
      7 satisfies TimestampEpochSecondsSchema,
      15 satisfies DocumentSchema,
      17 satisfies BigIntegerSchema,
      19 satisfies BigDecimalSchema,
      21 satisfies BlobSchema,

      [[1, "ns", "List", 0, () => Widget$] satisfies StaticListSchema, 0],
      [[1, "ns", "List", 0, () => Widget$] satisfies StaticListSchema, { sparse: 1 }],
      [2, "ns", "Map", 0, 0, () => Widget$] satisfies StaticMapSchema,
      [[2, "ns", "Map", 0, 0, () => Widget$] satisfies StaticMapSchema, { sparse: 1 }],

      () => Widget$,
    ],
    2,
  ] satisfies StaticStructureSchema;

  it("should detect type mismatches", () => {
    expect(
      validateSchema(Widget$, {
        string: 0,
        n: "",
        bool: 0,
        media: "ahh",
        timestamp: new Date(),
        document: {
          a: [0, 1, 2, 3],
        },
        bigint: 45,
        bigdecimal: 1.2,
        blob: [0, 1, 2, 3],

        list: {},
        sparseList: [0],
        map: [],
        sparseMap: { a: 0 },

        widget: 5,
      })
    ).toEqual([
      "{}.string: expected string, got number.",
      "{}.n: expected number, got string.",
      "{}.bool: expected boolean, got number.",
      "{}.bigint: expected bigint, got number.",
      "{}.bigdecimal: expected NumericValue, got number.",
      "{}.blob: expected Uint8Array, got object.",
      "{}.list:expected array (list), got object.",
      "{}.sparseList[0]: expected {ns#Widget}, got number",
      '{}.sparseMap["a"]: expected {ns#Widget}, got number',
      "{}.widget: expected {ns#Widget}, got number",
    ]);
  });
  it("should detect missing required members", () => {
    expect(validateSchema(Widget$, {})).toEqual(["{}.string: is required.", "{}.n: is required."]);

    expect(
      validateSchema(Widget$, {
        string: "",
        n: 0,
        list: [null, { string: "", n: 0 }],
        sparseList: [
          null,
          null,
          {
            string: ".",
          },
        ],
        sparseMap: {
          a: null,
          b: {
            n: 0,
          },
        },
        map: {
          a: null,
          b: {
            n: 0,
          },
        },
        widget: {
          string: "",
          n: 0,
          widget: {
            n: 0,
          },
        },
      })
    ).toEqual([
      "{}.list[0]: should be non-null.",
      "{}.sparseList[2].n: is required.",
      "{}.map[a]: should be non-null.",
      '{}.map["b"].string: is required.',
      '{}.sparseMap["b"].string: is required.',
      "{}.widget.widget.string: is required.",
    ]);
  });
  it("should detect extraneous members", () => {
    expect(
      validateSchema(Widget$, {
        string: "",
        n: 0,
        document: {
          a: 1,
          b: 2,
        },
        extra1: 0,
        extra2: 1,
        widget: { string: "", n: 0, extra1: 0, extra2: 1 },
      })
    ).toEqual(["{}: unmatched keys: extra1, extra2.", "{}.widget: unmatched keys: extra1, extra2."]);
  });
});
