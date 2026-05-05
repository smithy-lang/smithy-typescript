import type { Pluggable } from "@smithy/types";

import {
  compressionMiddleware,
  compressionMiddlewareOptions,
  type CompressionMiddlewareConfig,
} from "./compressionMiddleware";
import type { CompressionPreviouslyResolved, CompressionResolvedConfig } from "./configurations";

/**
 * @internal
 */
export const getCompressionPlugin = (
  config: CompressionResolvedConfig & CompressionPreviouslyResolved,
  middlewareConfig: CompressionMiddlewareConfig
): Pluggable<any, any> => ({
  applyToStack: (clientStack) => {
    clientStack.add(compressionMiddleware(config, middlewareConfig), compressionMiddlewareOptions);
  },
});
