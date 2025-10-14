import type { StaticErrorSchema } from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import { list } from "./schemas/ListSchema";
import { map } from "./schemas/MapSchema";
import { struct } from "./schemas/StructureSchema";
import { TypeRegistry } from "./TypeRegistry";

describe(TypeRegistry.name, () => {
  const [List, Map, Struct] = [
    list("NAMESPACE", "List", { sparse: 1 }, 0),
    map("NAMESPACE", "Map", 0, 0, 1),
    () => schema,
  ];
  const schema = struct("NAMESPACE", "Structure", {}, ["list", "map", "struct"], [List, Map, Struct]);

  it("stores and retrieves schema objects", () => {
    const tr = TypeRegistry.for("NAMESPACE");
    tr.register(List.getName(), List);
    expect(tr.getSchema("List")).toBe(List);
    tr.register(Map.getName(), Map);
    expect(tr.getSchema("Map")).toBe(Map);
    tr.register(Struct().getName(), Struct());
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
});
