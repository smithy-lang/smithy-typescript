import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test as it } from "vitest";

import { BinaryDecisionDiagram } from "./bdd/BinaryDecisionDiagram";
import { decideEndpoint } from "./decideEndpoint";
import { resolveEndpoint } from "./resolveEndpoint";
import { EndpointError } from "./types";

describe(resolveEndpoint.name, () => {
  const mocksDir = resolve(__dirname, "__mocks__");
  const rulesDir = resolve(mocksDir, "valid-rules");
  const testCasesDir = resolve(mocksDir, "test-cases");

  const validRules = readdirSync(rulesDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => fileName.replace(".json", ""));

  describe.each(validRules)("%s", (ruleName) => {
    const rulesFile = resolve(rulesDir, `${ruleName}.json`);
    const testCasesFile = resolve(testCasesDir, `${ruleName}.json`);

    if (existsSync(testCasesFile)) {
      const ruleSetObject = require(rulesFile);
      const { testCases } = require(testCasesFile);

      for (const testCase of testCases) {
        const { documentation, params } = testCase;
        (testCase.skip ? it.skip : it)(documentation, () => {
          const _expect = testCase.expect;

          const { endpoint, error } = _expect;

          if (endpoint) {
            expect(resolveEndpoint(ruleSetObject, { endpointParams: params })).toStrictEqual({
              ...endpoint,
              url: new URL(endpoint.url),
            });
          }

          if (error) {
            expect(() => resolveEndpoint(ruleSetObject, { endpointParams: params })).toThrowError(
              new EndpointError(error)
            );
          }
        });
      }
    }
  });
});

describe(decideEndpoint.name, () => {
  describe("split, ite, and getAttr with negative index", () => {
    const r = 100_000_000;

    const conditions = [
      ["split", [{ ref: "Splittable" }, ".", 0], "parts"],
      ["getAttr", [{ ref: "parts" }, "[-2]"], "tld"],
      ["stringEquals", [{ ref: "tld" }, "com"], "isCom"],
    ];

    const results = [[{ fn: "ite", argv: [{ ref: "isCom" }, "https://api.___.com", "https://api.___.net"] }, {}, {}]];

    const nodes = new Int32Array([
      0,
      0,
      0,
      // (2, start) - split Splittable by "." with unlimited parts and proceed to node 3.
      0,
      3,
      -1,
      // (3) - getAttr [-2] and assign to tld, proceed to node 4.
      1,
      4,
      -1,
      // (4) - compare tld to "com" as isCom and proceed to terminal 0.
      2,
      r + 0,
      r + 0,
    ]);

    const bdd = BinaryDecisionDiagram.from(nodes, 2, conditions, results);

    it("should resolve endpoint using split + getAttr[-1] + ite", () => {
      const endpoint = decideEndpoint(bdd, {
        endpointParams: { Splittable: "___.com.___" },
      });
      expect(endpoint).toEqual({
        url: new URL("https://api.___.com"),
        properties: {},
        headers: {},
      });
    });

    it("should pick alternate URL when getAttr[-1] yields non-com TLD", () => {
      const endpoint = decideEndpoint(bdd, {
        endpointParams: { Splittable: "___.org.___" },
      });
      expect(endpoint).toEqual({
        url: new URL("https://api.___.net"),
        properties: {},
        headers: {},
      });
    });
  });
});
