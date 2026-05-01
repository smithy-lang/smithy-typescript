import { describe, expect, test as it, vi } from "vitest";

import { fromValue as convertToProvider } from "../property-provider/fromValue";
import { fromStatic } from "./fromStatic";

vi.mock("../property-provider/fromValue", () => ({
  fromValue: vi.fn(),
}));

describe("fromStatic", () => {
  const value = "default" as any;
  it("should convert static values to provider", async () => {
    vi.mocked(convertToProvider).mockReturnValue(value);
    fromStatic(value);
    expect(vi.mocked(convertToProvider)).toHaveBeenCalledWith(value);
  });

  it("should call the getter function", async () => {
    const getter = vi.fn().mockReturnValue(value);
    const config = fromStatic(getter);
    expect(await config()).toBe(value);
    expect(getter).toHaveBeenCalled();
  });

  it("should call the async provider function", async () => {
    const getter = vi.fn().mockResolvedValue(value);
    const config = fromStatic(getter);
    expect(await config()).toBe(value);
    expect(getter).toHaveBeenCalled();
  });
});
