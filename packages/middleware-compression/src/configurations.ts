import { BodyLengthCalculator, Provider } from "@smithy/types";

/**
 * @public
 */
export interface CompressionInputConfig {
  /**
   * Whether to disable request compression.
   */
  disableRequestCompression?: boolean | Provider<boolean>;

  /**
   * The minimum size in bytes that a request body should be to trigger compression.
   * The value must be a non-negative integer value between 0 and 10485760 bytes inclusive.
   */
  requestMinCompressionSizeBytes?: number | Provider<number>;
}

/**
 * @internal
 */
export interface CompressionPreviouslyResolved {
  /**
   * A function that can calculate the length of a body.
   */
  bodyLengthChecker: BodyLengthCalculator;
}

/**
 * @internal
 */
export interface CompressionResolvedConfig {
  /**
   * Resolved value for input config {@link CompressionInputConfig.disableRequestCompression}
   */
  disableRequestCompression: Provider<boolean>;

  /**
   * Resolved value for input config {@link CompressionInputConfig.requestMinCompressionSizeBytes}
   */
  requestMinCompressionSizeBytes: Provider<number>;
}
