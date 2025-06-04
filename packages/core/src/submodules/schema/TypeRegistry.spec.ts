import { describe, expect, test as it } from "vitest";

import { error } from "./schemas/ErrorSchema";
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
    expect(tr.getSchema("List")).toBe(List);
    expect(tr.getSchema("Map")).toBe(Map);
    expect(tr.getSchema("Structure")).toBe(schema);
  });

  it("has a helper method to retrieve a synthetic base exception", () => {
    // the service namespace is appended to the synthetic prefix.
    const err = error("smithy.ts.sdk.synthetic.NAMESPACE", "UhOhServiceException", 0, [], [], Error);
    const tr = TypeRegistry.for("smithy.ts.sdk.synthetic.NAMESPACE");
    expect(tr.getBaseException()).toBe(err);
  });
});
