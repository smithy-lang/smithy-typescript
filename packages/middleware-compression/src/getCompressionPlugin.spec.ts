import { compressionMiddleware, compressionMiddlewareOptions } from "./compressionMiddleware";
import { getCompressionPlugin } from "./getCompressionPlugin";

jest.mock("./compressionMiddleware");

describe(getCompressionPlugin.name, () => {
  const config = {
    bodyLengthChecker: jest.fn(),
    disableRequestCompression: async () => false,
    requestMinCompressionSizeBytes: async () => 0,
  };
  const middlewareConfig = { encodings: [] };

  it("applyToStack adds compressionMiddleware", () => {
    const middlewareReturn = {};
    (compressionMiddleware as jest.Mock).mockReturnValueOnce(middlewareReturn);

    const plugin = getCompressionPlugin(config, middlewareConfig);
    const commandStack = { add: jest.fn() };

    // @ts-ignore
    plugin.applyToStack(commandStack);
    expect(commandStack.add).toHaveBeenCalledWith(middlewareReturn, compressionMiddlewareOptions);
    expect(compressionMiddleware).toHaveBeenCalled();
    expect(compressionMiddleware).toHaveBeenCalledWith(config, middlewareConfig);
  });
});
