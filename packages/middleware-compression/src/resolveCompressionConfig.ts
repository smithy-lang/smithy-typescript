import { normalizeProvider } from "@smithy/util-middleware";

import { CompressionInputConfig, CompressionResolvedConfig } from "./configurations";

/**
 * @internal
 */
export const resolveCompressionConfig = <T>(input: T & CompressionInputConfig): T & CompressionResolvedConfig => ({
  ...input,
  disableRequestCompression: normalizeProvider(input.disableRequestCompression),
  requestMinCompressionSizeBytes: normalizeProvider(input.requestMinCompressionSizeBytes),
});
