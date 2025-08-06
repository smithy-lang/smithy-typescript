import { describe, expect, test as it } from "vitest";

import { generateIdempotencyToken } from "./generateIdempotencyToken";

describe("generateIdempotencyToken", () => {
  // This test is not meaningful when using uuid v4 as an external package, but
  // will become useful if replacing the uuid implementation in the future.
  const tokens = {} as Record<string, boolean>;

  it("should repeatedly generate uuid v4 strings", () => {
    for (let i = 0; i < 1000; ++i) {
      const token = generateIdempotencyToken();
      tokens[token] = true;
      expect(generateIdempotencyToken()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    }

    expect(Object.keys(tokens)).toHaveLength(1000);
  });
});
