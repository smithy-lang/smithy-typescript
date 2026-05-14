import { describe, expect, it } from "vitest";

import { dependencies, peerDependencies } from "../package.json";

describe("undici version", () => {
  it("dependencies[undici] should match peerDependencies[undici]", () => {
    expect(dependencies["undici"]).toEqual(peerDependencies["undici"]);
  });
});
