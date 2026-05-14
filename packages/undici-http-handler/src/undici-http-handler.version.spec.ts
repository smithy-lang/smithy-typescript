import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { dependencies, peerDependencies } = require("../package.json");

describe("undici version", () => {
  it("dependencies[undici] should match peerDependencies[undici]", () => {
    expect(dependencies["undici"]).toEqual(peerDependencies["undici"]);
  });
});
