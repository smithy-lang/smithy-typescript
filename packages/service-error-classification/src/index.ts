import { SdkError } from "@smithy/types";

import {
  CLOCK_SKEW_ERROR_CODES,
  NODEJS_NETWORK_ERROR_CODES,
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

/**
 *
 * @internal
 */
export const isBrowserNetworkError = (error: SdkError) => {
  const errorMessages = new Set([
    "Failed to fetch", // Chrome
    "NetworkError when attempting to fetch resource", // Firefox
    "The Internet connection appears to be offline", // Safari 16
    "Load failed", // Safari 17+
    "Network request failed", // `cross-fetch`
  ]);

  const isValid = error && error instanceof TypeError;

  if (!isValid) {
    return false;
  }

  return errorMessages.has(error.message);
};

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
export const isTransientError = (error: SdkError, depth = 0): boolean =>
  isClockSkewCorrectedError(error) ||
  TRANSIENT_ERROR_CODES.includes(error.name) ||
  NODEJS_TIMEOUT_ERROR_CODES.includes((error as { code?: string })?.code || "") ||
  NODEJS_NETWORK_ERROR_CODES.includes((error as { code?: string })?.code || "") ||
  TRANSIENT_ERROR_STATUS_CODES.includes(error.$metadata?.httpStatusCode || 0) ||
  isBrowserNetworkError(error) ||
  (error.cause !== undefined && depth <= 10 && isTransientError(error.cause, depth + 1));

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
