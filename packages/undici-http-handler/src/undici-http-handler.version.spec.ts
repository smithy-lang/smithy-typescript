import { describe, expect, it } from "vitest";

import { dependencies, engines, peerDependencies } from "../package.json";

const EXPECTED_ENGINES_NODE = ">=18.0.0";

describe("undici version", () => {
  it("dependencies[undici] should match peerDependencies[undici]", () => {
    expect(dependencies["undici"]).toEqual(peerDependencies["undici"]);
  });

  it(`engines.node should be ${EXPECTED_ENGINES_NODE}`, () => {
    expect(
      engines.node,
      "Note: If engines.node was updated to drop support for Node.js major version," +
        " check if undici version can also be updated with this change."
    ).toEqual(EXPECTED_ENGINES_NODE);
  });
});
