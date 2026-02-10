import type { StaticErrorSchema, StaticListSchema, StaticMapSchema, StaticStructureSchema } from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import { TypeRegistry } from "./TypeRegistry";

describe(TypeRegistry.name, () => {
  const [List, Map, Struct]: [StaticListSchema, StaticMapSchema, () => StaticStructureSchema] = [
    [1, "NAMESPACE", "List", { sparse: 1 }, 0],
    [2, "NAMESPACE", "Map", 0, 0, 1],
    () => schema,
  ];
  const schema: StaticStructureSchema = [
    3,
    "NAMESPACE",
    "Structure",
    {},
    ["list", "map", "struct"],
    [List, Map, Struct],
  ];

  it("stores and retrieves schema objects", () => {
    const tr = TypeRegistry.for("NAMESPACE");

    tr.register(`${List[1]}#${List[2]}`, List);
    expect(tr.getSchema("List")).toBe(List);

    tr.register(`${Map[1]}#${Map[2]}`, Map);
    expect(tr.getSchema("Map")).toBe(Map);

    tr.register(`${Struct()[1]}#${Struct()[2]}`, Struct());
    expect(tr.getSchema("Structure")).toBe(schema);
  });

  it("has a helper method to retrieve a synthetic base exception", () => {
    // the service namespace is appended to the synthetic prefix.
    const err = [
      -3,
      "smithy.ts.sdk.synthetic.NAMESPACE",
      "UhOhServiceException",
      0,
      [],
      [],
    ] satisfies StaticErrorSchema;
    const tr = TypeRegistry.for(err[1]);
    tr.registerError(err, Error);
    expect(tr.getBaseException()).toBe(err);
  });

  describe("composition", () => {
    it("can be composed", () => {
      const tr1 = TypeRegistry.for("namespace");
      const tr2 = TypeRegistry.for("other");

      tr1.register("namespace#List", List);
      tr2.register("other#List", List);

      tr1.copyFrom(tr2);
      tr2.copyFrom(tr1);

      expect(tr1.getSchema("other#List")).toBe(List);
      expect(tr2.getSchema("namespace#List")).toBe(List);

      expect(() => tr1.getSchema("List")).not.toThrow();
      expect(() => tr2.getSchema("List")).not.toThrow();
    });

    it("does not overwrite during composition", () => {
      const nsRegistry = TypeRegistry.for("namespace");
      const otherRegistry = TypeRegistry.for("other");

      // non-canonical
      otherRegistry.register("namespace#Value", 1);
      // canonical
      nsRegistry.register("namespace#Value", 0);

      // non-canonical
      nsRegistry.register("other#Value", 1);
      // canonical
      otherRegistry.register("other#Value", 0);

      nsRegistry.copyFrom(otherRegistry);
      otherRegistry.copyFrom(nsRegistry);

      expect(nsRegistry.getSchema("namespace#Value")).toBe(0);
      expect(nsRegistry.getSchema("other#Value")).toBe(1);

      expect(otherRegistry.getSchema("namespace#Value")).toBe(1);
      expect(otherRegistry.getSchema("other#Value")).toBe(0);
    });
  });
});
