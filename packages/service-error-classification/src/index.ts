import { SdkError } from "@smithy/types";

import {
  CLOCK_SKEW_ERROR_CODES,
  NODEJS_TIMEOUT_ERROR_CODES,
  THROTTLING_ERROR_CODES,
  TRANSIENT_ERROR_CODES,
  TRANSIENT_ERROR_STATUS_CODES,
} from "./constants";

export const isRetryableByTrait = (error: SdkError) => error.$retryable !== undefined;

/**
 * @deprecated use isClockSkewCorrectedError. This is only used in deprecated code.
 */
export const isClockSkewError = (error: SdkError) => CLOCK_SKEW_ERROR_CODES.includes(error.name);

/**
 * @returns whether the error resulted in a systemClockOffset aka clock skew correction.
 */
export const isClockSkewCorrectedError = (error: SdkError) => error.$metadata?.clockSkewCorrected;

export const isThrottlingError = (error: SdkError) =>
  error.$metadata?.httpStatusCode === 429 ||
  THROTTLING_ERROR_CODES.includes(error.name) ||
  error.$retryable?.throttling == true;

/**
 * Though NODEJS_TIMEOUT_ERROR_CODES are platform specific, they are
 * included here because there is an error scenario with unknown root
 * cause where the NodeHttpHandler does not decorate the Error with
 * the name "TimeoutError" to be checked by the TRANSIENT_ERROR_CODES condition.
 */
export const isTransientError = (error: SdkError) =>
  isClockSkewCorrectedError(error) ||
  TRANSIENT_ERROR_CODES.includes(error.name) ||
  NODEJS_TIMEOUT_ERROR_CODES.includes((error as { code?: string })?.code || "") ||
  TRANSIENT_ERROR_STATUS_CODES.includes(error.$metadata?.httpStatusCode || 0) ||
  (error.cause !== undefined && isTransientError(error.cause));

export const isServerError = (error: SdkError) => {
  if (error.$metadata?.httpStatusCode !== undefined) {
    const statusCode = error.$metadata.httpStatusCode;
    if (500 <= statusCode && statusCode <= 599 && !isTransientError(error)) {
      return true;
    }
    return false;
  }
  return false;
};
