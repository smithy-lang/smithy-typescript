import { fromStatic as convertToProvider } from "@smithy/property-provider";

import { fromStatic } from "./fromStatic";

jest.mock("@smithy/property-provider", () => ({
  fromStatic: vi.fn(),
}));

describe("fromStatic", () => {
  const value = "default";
  it("should convert static values to provider", async () => {
    (convertToProvider as jest.Mock).mockReturnValue(value);
    fromStatic(value);
    expect(convertToProvider as jest.Mock).toHaveBeenCalledWith(value);
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
