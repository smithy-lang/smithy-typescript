import { getRandomValues } from "crypto";
import { afterEach, beforeEach, describe, expect, test as it, vi } from "vitest";

describe("randomUUID", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("should call native randomUUID when available", async () => {
    const mockUUID = "mocked-uuid";
    const nativeRandomUUID = vi.fn(() => mockUUID);
    vi.doMock("./randomUUID", () => ({ randomUUID: nativeRandomUUID }));

    const { randomUUID } = await import("./index");
    const uuid = randomUUID();

    expect(nativeRandomUUID).toHaveBeenCalled();
    expect(uuid).toBe(mockUUID);
  });

  describe("when native randomUUID is not available", () => {
    let randomUUID: any;
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    beforeEach(async () => {
      vi.doMock("./randomUUID", () => ({ randomUUID: undefined }));
      randomUUID = (await import("./index")).randomUUID;

      // Simulate crypto.getRandomValues in test, as it's expected to be available
      global.crypto = {
        getRandomValues: getRandomValues,
      } as any;
    });

    it("each generation is unique and matches regex", () => {
      const uuids = new Set();
      const iterations = 10_000;
      for (let i = 0; i < iterations; i++) {
        const uuid = randomUUID();
        expect(uuid).toMatch(UUID_REGEX);
        uuids.add(uuid);
      }
      expect(uuids.size).toBe(iterations);
    });
  });
});
