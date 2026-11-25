import { describe, expect, it } from "vitest";

import { fromBase64 as fromBase64Node } from "./fromBase64";
import { fromBase64 as fromBase64Browser } from "./fromBase64.browser";

for (const [runtime, decode] of [
  ["browser", fromBase64Browser],
  ["node", fromBase64Node],
] as const) {
  describe(`${runtime} Base64 padding`, () => {
    it.each([
      "A",
      "AA",
      "AAA",
      "AA=",
      "=",
      "===",
      "A===",
      "====",
      "=AAA",
      "A=AA",
      "AA=A",
      "AA==AAAA",
      "AA==AA==",
      "AAAA=AAA",
      "AAAA====",
    ])("rejects malformed padding in %j with a TypeError", (encoded) => {
      expect(() => decode(encoded)).toThrow(TypeError);
    });

    it.each([
      { encoded: "", bytes: [] },
      { encoded: "AA==", bytes: [0] },
      { encoded: "AAA=", bytes: [0, 0] },
      { encoded: "AAAA", bytes: [0, 0, 0] },
      { encoded: "Zm9v", bytes: [102, 111, 111] },
      { encoded: "Zm9vYg==", bytes: [102, 111, 111, 98] },
      { encoded: "Zm9vYmE=", bytes: [102, 111, 111, 98, 97] },
    ])("preserves valid encoding $encoded", ({ encoded, bytes }) => {
      expect(decode(encoded)).toEqual(new Uint8Array(bytes));
    });
  });
}
