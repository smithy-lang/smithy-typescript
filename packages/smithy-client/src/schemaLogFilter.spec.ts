import { list, map, SCHEMA, sim, struct } from "@smithy/core/schema";
import { describe, expect, test as it } from "vitest";

import { schemaLogFilter } from "./schemaLogFilter";

describe(schemaLogFilter.name, () => {
  it("should filter sensitive trait-marked fields", () => {
    const sensitiveString = sim("ns", "SensitiveString", 0, { sensitive: 1 });

    const schema = struct(
      "ns",
      "Struct",
      0,
      ["a", "b", "sensitive", "nestedSensitive", "various"],
      [
        SCHEMA.STRING,
        SCHEMA.STRING,
        sensitiveString,
        struct("ns", "NestedSensitiveStruct", 0, ["sensitive"], [sensitiveString]),
        struct(
          "ns",
          "Various",
          0,
          ["boolean", "number", "struct", "list-s", "list", "map-s", "map"],
          [
            sim("ns", "Boolean", SCHEMA.BOOLEAN, { sensitive: 1 }),
            sim("ns", "Numeric", SCHEMA.NUMERIC, { sensitive: 1 }),
            struct("ns", "SensitiveStruct", { sensitive: 1 }, [], []),
            list("ns", "List", 0, sensitiveString),
            list("ns", "List", 0, SCHEMA.STRING),
            map("ns", "Map", 0, sensitiveString, SCHEMA.STRING),
            map("ns", "Map", 0, SCHEMA.STRING, SCHEMA.STRING),
          ]
        ),
      ]
    );

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
});
