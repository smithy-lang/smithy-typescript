import { describe, expect, it } from "vitest";

import { dependencies, engines, peerDependencies } from "../package.json";

const EXPECTED_ENGINES_NODE = ">=18.0.0";

describe("undici version", () => {
  it("peerDependencies[undici] should accept dependencies[undici]", () => {
    expect(peerDependencies["undici"]).toEqual(`>=${dependencies["undici"].replace("^", "")}`);
  });

  it(`engines.node should be ${EXPECTED_ENGINES_NODE}`, () => {
    expect(
      engines.node,
      "Note: If engines.node was updated to drop support for Node.js major version," +
        " check if undici version can also be updated with this change."
    ).toEqual(EXPECTED_ENGINES_NODE);
  });
});
