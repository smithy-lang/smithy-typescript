import { test as it, vi, describe, expect } from "vitest";

import { compressionMiddleware, compressionMiddlewareOptions } from "./compressionMiddleware";
import { getCompressionPlugin } from "./getCompressionPlugin";

vi.mock("./compressionMiddleware");

describe(getCompressionPlugin.name, () => {
  const config = {
    bodyLengthChecker: vi.fn(),
    disableRequestCompression: async () => false,
    requestMinCompressionSizeBytes: async () => 0,
  };
  const middlewareConfig = { encodings: [] };

  it("applyToStack adds compressionMiddleware", () => {
    const middlewareReturn = {} as any;
    (vi.mocked(compressionMiddleware)).mockReturnValueOnce(middlewareReturn);

    const plugin = getCompressionPlugin(config, middlewareConfig);
    const commandStack = { add: vi.fn() };

    // @ts-ignore
    plugin.applyToStack(commandStack);
    expect(commandStack.add).toHaveBeenCalledWith(middlewareReturn, compressionMiddlewareOptions);
    expect(compressionMiddleware).toHaveBeenCalled();
    expect(compressionMiddleware).toHaveBeenCalledWith(config, middlewareConfig);
  });
});
