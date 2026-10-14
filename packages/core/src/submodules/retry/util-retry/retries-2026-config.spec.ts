import { describe, expect, test as it } from "vitest";

import { Retry } from "./retries-2026-config";

describe("Retry (2026 compatibility shim)", () => {
  it("is always enabled", () => {
    expect(Retry.v2026).toBe(true);
  });
});
