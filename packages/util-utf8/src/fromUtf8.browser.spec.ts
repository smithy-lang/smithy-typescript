import { describe, expect, test as it, vi } from "vitest";

import { fromUtf8 } from "./fromUtf8.browser";

declare const global: any;

describe("fromUtf8", () => {
  it("should use the Encoding API", () => {
    const expected = new Uint8Array(0);
    const encode = vi.fn().mockReturnValue(expected);
    (global as any).TextEncoder = vi.fn(() => ({ encode }));

    expect(fromUtf8("ABC")).toBe(expected);
  });
});
