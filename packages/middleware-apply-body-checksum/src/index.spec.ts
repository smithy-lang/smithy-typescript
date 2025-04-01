import { describe, expect, test as it, vi } from "vitest";

import { applyMd5BodyChecksumMiddleware, resolveMd5BodyChecksumConfig } from "./index";

describe("middleware-apply-body-checksum package exports", () => {
  it("maintains object custody", () => {
    const input = {
      md5: vi.fn(),
      base64Encoder: vi.fn(),
      streamHasher: vi.fn(),
    };
    expect(resolveMd5BodyChecksumConfig(input)).toBe(input);
  });

  it("applyMd5BodyChecksumMiddleware", () => {
    expect(typeof applyMd5BodyChecksumMiddleware).toBe("function");
  });
});
