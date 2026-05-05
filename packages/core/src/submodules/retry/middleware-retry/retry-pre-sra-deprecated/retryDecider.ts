import type { SdkError } from "@smithy/types";

import {
  isClockSkewError,
  isRetryableByTrait,
  isThrottlingError,
  isTransientError,
} from "../../service-error-classification/service-error-classification";

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
