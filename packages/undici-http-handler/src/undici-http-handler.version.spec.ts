import { engines as undiciEngines } from "undici/package.json";
import { describe, expect, it } from "vitest";

import { dependencies, engines, peerDependencies } from "../package.json";

const EXPECTED_ENGINES_NODE = ">=20.18.1";

describe("undici version", () => {
  it("peerDependencies[undici] should accept dependencies[undici]", () => {
    expect(peerDependencies["undici"]).toEqual(`>=${dependencies["undici"].replace("^", "")}`);
  });

  it(`engines.node should be ${EXPECTED_ENGINES_NODE}`, () => {
    expect(
      engines.node,
      "Note: If engines.node was updated to drop support for Node.js major version," +
        " the undici version should ideally be also updated with this change."
    ).toEqual(EXPECTED_ENGINES_NODE);
  });

  it("engines.node should match undici's engines.node", () => {
    expect(
      engines.node,
      "Note: undici-http-handler engines.node should be the same as undici's engines.node." +
        " If undici updated it's engines requirement, update undici-http-handler to match."
    ).toEqual(undiciEngines.node);
  });
});
