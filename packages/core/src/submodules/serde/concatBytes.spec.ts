import { describe, expect, test as it } from "vitest";

import { concatBytes } from "./concatBytes";

describe("concatBytes", () => {
  it("should return empty Uint8Array for empty input", () => {
    expect(concatBytes([])).toEqual(new Uint8Array(0));
  });

  it("should return a copy of a single buffer", () => {
    const input = new Uint8Array([1, 2, 3]);
    const result = concatBytes([input]);
    expect(result).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.buffer).not.toBe(input.buffer);
  });

  it("should concatenate multiple buffers", () => {
    const result = concatBytes([new Uint8Array([1, 2]), new Uint8Array([3, 4, 5]), new Uint8Array([6])]);
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
  });

  it("should handle buffers with zero length", () => {
    const result = concatBytes([new Uint8Array([1]), new Uint8Array(0), new Uint8Array([2])]);
    expect(result).toEqual(new Uint8Array([1, 2]));
  });

  it("should return a Uint8Array with its own ArrayBuffer", () => {
    const result = concatBytes([new Uint8Array([1, 2]), new Uint8Array([3, 4])]);
    expect(result.byteOffset).toBe(0);
    expect(result.buffer.byteLength).toBe(4);
  });
});
