/** @deprecated Use @smithy/core/retry instead. */
export {
  isRetryableByTrait,
  isClockSkewError,
  isClockSkewCorrectedError,
  isBrowserNetworkError,
  isThrottlingError,
  isTransientError,
  isServerError,
  isNodeJsHttp2TransientError,
} from "@smithy/core/retry";
