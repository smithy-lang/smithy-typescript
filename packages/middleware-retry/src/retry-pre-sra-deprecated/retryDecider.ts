import {
  isClockSkewError,
  isRetryableByTrait,
  isThrottlingError,
  isTransientError,
} from "@smithy/service-error-classification";
import type { SdkError } from "@smithy/types";

/**
 * @internal
 * @deprecated this is only used in the deprecated StandardRetryStrategy. Do not use in new code.
 */
export const defaultRetryDecider = (error: SdkError) => {
  if (!error) {
    return false;
  }

  return isRetryableByTrait(error) || isClockSkewError(error) || isThrottlingError(error) || isTransientError(error);
};
