import { normalizeProvider } from "@smithy/util-middleware";

import { CompressionInputConfig, CompressionResolvedConfig } from "./configurations";

/**
 * @internal
 */
export const resolveCompressionConfig = <T>(input: T & CompressionInputConfig): T & CompressionResolvedConfig => ({
  ...input,
  disableRequestCompression: normalizeProvider(input.disableRequestCompression),
  requestMinCompressionSizeBytes: async () => {
    const requestMinCompressionSizeBytes = await normalizeProvider(input.requestMinCompressionSizeBytes)();

    // The requestMinCompressionSizeBytes should be less than the upper limit for API Gateway
    // https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-openapi-minimum-compression-size.html
    if (requestMinCompressionSizeBytes < 0 || requestMinCompressionSizeBytes > 10485760) {
      throw new RangeError(
        "The value for requestMinCompressionSizeBytes must be between 0 and 10485760 inclusive. " +
          `The provided value ${requestMinCompressionSizeBytes} is outside this range."`
      );
    }

    return requestMinCompressionSizeBytes;
  },
});
