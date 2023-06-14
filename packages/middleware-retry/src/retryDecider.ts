import {
  isClockSkewError,
  isRetryableByTrait,
  isThrottlingError,
  isTransientError,
} from "@smithy/service-error-classification";
import { SdkError } from "@smithy/types";

export const defaultRetryDecider = (error: SdkError) => {
  if (!error) {
    return false;
  }

  return isRetryableByTrait(error) || isClockSkewError(error) || isThrottlingError(error) || isTransientError(error);
};
