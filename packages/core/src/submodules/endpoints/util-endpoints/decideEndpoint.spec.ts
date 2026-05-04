import { describe, expect, test as it } from "vitest";

import { BinaryDecisionDiagram } from "./bdd/BinaryDecisionDiagram";
import { decideEndpoint } from "./decideEndpoint";

describe(decideEndpoint.name, () => {
  it("resolves an endpoint", () => {
    const d = "x-api-key";
    const a = "isSet",
      b = "{endpoint}",
      c = ["{ApiKey}"];
    const _data = {
      conditions: [
        [a, [{ ref: "ApiKey" }]],
        [a, [{ ref: "CustomHeaderValue" }]],
      ],
      results: [
        [-1],
        [b, {}, { [d]: c, "x-custom-header": ["{CustomHeaderValue}"] }],
        [b, {}, { [d]: c }],
        [b, {}, {}],
      ],
    };

    const root = 2;
    const r = 100_000_000;
    const bdd = new Int32Array([-1, 1, -1, 0, 3, r + 3, 1, r + 1, r + 2]);

    const data = BinaryDecisionDiagram.from(bdd, root, _data.conditions, _data.results);
    const endpoint = decideEndpoint(data, {
      endpointParams: { endpoint: "https://localhost/" },
    });
    expect(endpoint).toEqual({
      url: new URL("https://localhost"),
      properties: {},
      headers: {},
    });
  });

  it("evaluates templates in error messages", () => {
    const r = 100_000_000;
    const bdd = new Int32Array([0, 0, 0, 0, r + 0, -1]);
    const data = BinaryDecisionDiagram.from(
      bdd,
      2,
      [["isSet", [{ ref: "Region" }]]],
      [[-1, "Invalid region: {Region}"]]
    );
    expect(() =>
      decideEndpoint(data, {
        endpointParams: { Region: "us-west-2" },
      })
    ).toThrow("Invalid region: us-west-2");
  });
});
