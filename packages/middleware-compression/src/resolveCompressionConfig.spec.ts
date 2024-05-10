import { resolveCompressionConfig } from "./resolveCompressionConfig";

describe(resolveCompressionConfig.name, () => {
  const mockConfig = {
    bodyLengthChecker: vi.fn(),
    disableRequestCompression: false,
    requestMinCompressionSizeBytes: 0,
  };

  it("should throw an error if requestMinCompressionSizeBytes is less than 0", async () => {
    const requestMinCompressionSizeBytes = -1;
    const resolvedConfig = resolveCompressionConfig({ ...mockConfig, requestMinCompressionSizeBytes });
    await expect(resolvedConfig.requestMinCompressionSizeBytes()).rejects.toThrow(
      new RangeError(
        "The value for requestMinCompressionSizeBytes must be between 0 and 10485760 inclusive. " +
          `The provided value ${requestMinCompressionSizeBytes} is outside this range."`
      )
    );
  });

  it("should throw an error if requestMinCompressionSizeBytes is greater than 10485760", async () => {
    const requestMinCompressionSizeBytes = 10485761;
    const resolvedConfig = resolveCompressionConfig({ ...mockConfig, requestMinCompressionSizeBytes });
    await expect(resolvedConfig.requestMinCompressionSizeBytes()).rejects.toThrow(
      new RangeError(
        "The value for requestMinCompressionSizeBytes must be between 0 and 10485760 inclusive. " +
          `The provided value ${requestMinCompressionSizeBytes} is outside this range."`
      )
    );
  });

  it.each([0, 10240, 10485760])(
    "returns requestMinCompressionSizeBytes value %s",
    async (requestMinCompressionSizeBytes) => {
      const inputConfig = { ...mockConfig, requestMinCompressionSizeBytes };
      const resolvedConfig = resolveCompressionConfig(inputConfig);
      await expect(resolvedConfig.requestMinCompressionSizeBytes()).resolves.toEqual(requestMinCompressionSizeBytes);
    }
  );

  it.each([false, true])("returns disableRequestCompression value %s", async (disableRequestCompression) => {
    const inputConfig = { ...mockConfig, disableRequestCompression };
    const resolvedConfig = resolveCompressionConfig(inputConfig);
    await expect(resolvedConfig.disableRequestCompression()).resolves.toEqual(disableRequestCompression);
  });
});
