import { describe, expect, test as it } from "vitest";

import { error } from "./schemas/ErrorSchema";
import { list } from "./schemas/ListSchema";
import { map } from "./schemas/MapSchema";
import { struct } from "./schemas/StructureSchema";
import { TypeRegistry } from "./TypeRegistry";

describe(TypeRegistry.name, () => {
  const [List, Map, Struct] = [list("ack", "List", { sparse: 1 }, 0), map("ack", "Map", 0, 0, 1), () => schema];
  const schema = struct("ack", "Structure", {}, ["list", "map", "struct"], [List, Map, Struct]);

  const tr = TypeRegistry.for("ack");

  it("stores and retrieves schema objects", () => {
    expect(tr.getSchema("List")).toBe(List);
    expect(tr.getSchema("Map")).toBe(Map);
    expect(tr.getSchema("Structure")).toBe(schema);
  });

  it("has a helper method to retrieve a synthetic base exception", () => {
    // the service namespace is appended to the synthetic prefix.
    const err = error("smithyts.client.synthetic.ack", "UhOhServiceException", 0, [], [], Error);
    const tr = TypeRegistry.for("smithyts.client.synthetic.ack");
    expect(tr.getBaseException()).toEqual(err);
  });
});
