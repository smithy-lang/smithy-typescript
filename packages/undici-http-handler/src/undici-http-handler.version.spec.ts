import { engines as undiciEngines } from "undici/package.json";
import { describe, expect, it } from "vitest";

import { dependencies, engines, peerDependencies } from "../package.json";

describe("undici version", () => {
  it("peerDependencies[undici] should accept dependencies[undici]", () => {
    expect(peerDependencies["undici"]).toEqual(`>=${dependencies["undici"].replace("^", "")}`);
  });

  it("engines.node should match undici's engines.node", () => {
    expect(
      engines.node,
      "Note: undici-http-handler engines.node should be the same as undici's engines.node." +
        " If undici updated its engines requirement as part of a new major version," +
        " update undici-http-handler engines.node to match and publish a new major version."
    ).toEqual(undiciEngines.node);
  });
});
