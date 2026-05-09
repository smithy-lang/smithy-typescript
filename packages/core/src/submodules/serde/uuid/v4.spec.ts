import { getRandomValues } from "node:crypto";
import { afterEach, describe, expect, test as it, vi } from "vitest";

import { bindV4 } from "./v4";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("v4", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call native crypto.randomUUID when available", () => {
    const mockUUID = "mocked-uuid-value";
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => mockUUID), getRandomValues });

    const v4 = bindV4(getRandomValues as (array: Uint8Array) => Uint8Array);
    const uuid = v4();

    expect(crypto.randomUUID).toHaveBeenCalled();
    expect(uuid).toBe(mockUUID);
  });

  describe("when native randomUUID is not available", () => {
    it("falls back to getRandomValues", () => {
      vi.stubGlobal("crypto", { getRandomValues });

      const mockGetRandomValues = vi.fn((array: Uint8Array) => {
        getRandomValues(array);
        return array;
      });
      const v4 = bindV4(mockGetRandomValues);

      const uuid = v4();

      expect(mockGetRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
      expect(uuid).toMatch(UUID_REGEX);
    });

    it("each generation is unique and matches regex", () => {
      vi.stubGlobal("crypto", { getRandomValues });

      const v4 = bindV4(getRandomValues as (array: Uint8Array) => Uint8Array);
      const uuids = new Set<string>();
      const iterations = 10_000;

      for (let i = 0; i < iterations; i++) {
        const uuid = v4();
        expect(uuid).toMatch(UUID_REGEX);
        uuids.add(uuid);
      }

      expect(uuids.size).toBe(iterations);
    });
  });
});
