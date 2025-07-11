import { RetryableTrait, SdkError } from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import {
  CLOCK_SKEW_ERROR_CODES,
  NODEJS_NETWORK_ERROR_CODES,
  NODEJS_TIMEOUT_ERROR_CODES,
  THROTTLING_ERROR_CODES,
  TRANSIENT_ERROR_CODES,
  TRANSIENT_ERROR_STATUS_CODES,
} from "./constants";
import { isClockSkewError, isRetryableByTrait, isServerError, isThrottlingError, isTransientError } from "./index";

const checkForErrorType = (
  isErrorTypeFunc: (error: SdkError) => boolean,
  options: {
    name?: string;
    httpStatusCode?: number;
    $retryable?: RetryableTrait;
    cause?: Partial<Error>;
    code?: string;
  },
  errorTypeResult: boolean
) => {
  const { name, httpStatusCode, $retryable, cause, code } = options;
  const error = Object.assign(new Error(), {
    name,
    $metadata: { httpStatusCode },
    $retryable,
    cause,
    code,
  });
  expect(isErrorTypeFunc(error as SdkError)).toBe(errorTypeResult);
};

describe("isRetryableByTrait", () => {
  it("should declare error with $retryable set to be a Retryable by trait", () => {
    const $retryable = {};
    checkForErrorType(isRetryableByTrait, { $retryable }, true);
  });

  it("should not declare error with $retryable not set to be a Retryable by trait", () => {
    checkForErrorType(isRetryableByTrait, {}, false);
  });
});

describe("isClockSkewError", () => {
  CLOCK_SKEW_ERROR_CODES.forEach((name) => {
    it(`should declare error with the name "${name}" to be a ClockSkew error`, () => {
      checkForErrorType(isClockSkewError, { name }, true);
    });
  });

  while (true) {
    const name = Math.random().toString(36).substring(2);
    if (!CLOCK_SKEW_ERROR_CODES.includes(name)) {
      it(`should not declare error with the name "${name}" to be a ClockSkew error`, () => {
        checkForErrorType(isClockSkewError, { name }, false);
      });
      break;
    }
  }
});

describe("isThrottlingError", () => {
  [429].forEach((httpStatusCode) => {
    it(`should declare error with the HTTP Status Code "${httpStatusCode}" to be a Throttling error`, () => {
      checkForErrorType(isTransientError, { httpStatusCode }, false);
    });
  });

  THROTTLING_ERROR_CODES.forEach((name) => {
    it(`should declare error with the name "${name}" to be a Throttling error`, () => {
      checkForErrorType(isThrottlingError, { name }, true);
    });
  });

  while (true) {
    const name = Math.random().toString(36).substring(2);
    if (!THROTTLING_ERROR_CODES.includes(name)) {
      it(`should not declare error with the name "${name}" to be a Throttling error`, () => {
        checkForErrorType(isThrottlingError, { name }, false);
      });
      break;
    }
  }

  it("should declare error with $retryable.throttling set to true to be a Throttling error", () => {
    const $retryable = { throttling: true };
    checkForErrorType(isThrottlingError, { $retryable }, true);
  });

  it("should not declare error with $retryable.throttling set to false to be a Throttling error", () => {
    const $retryable = { throttling: false };
    checkForErrorType(isThrottlingError, { $retryable }, false);
  });

  it("should not declare error with $retryable.throttling not set to be a Throttling error", () => {
    const $retryable = {};
    checkForErrorType(isThrottlingError, { $retryable }, false);
  });
});

describe("isTransientError", () => {
  TRANSIENT_ERROR_CODES.forEach((name) => {
    it(`should declare error with the name "${name}" to be a Transient error`, () => {
      checkForErrorType(isTransientError, { name }, true);
    });
  });

  TRANSIENT_ERROR_STATUS_CODES.forEach((httpStatusCode) => {
    it(`should declare error with the HTTP Status Code "${httpStatusCode}" to be a Transient error`, () => {
      checkForErrorType(isTransientError, { httpStatusCode }, true);
    });
  });

  while (true) {
    const name = Math.random().toString(36).substring(2);
    if (!TRANSIENT_ERROR_CODES.includes(name)) {
      it(`should not declare error with the name "${name}" to be a Transient error`, () => {
        checkForErrorType(isTransientError, { name }, false);
      });
      break;
    }
  }

  while (true) {
    const httpStatusCode = Math.ceil(Math.random() * 10 ** 3);
    if (!TRANSIENT_ERROR_STATUS_CODES.includes(httpStatusCode)) {
      it(`should declare error with the HTTP Status Code "${httpStatusCode}" to be a Transient error`, () => {
        checkForErrorType(isTransientError, { httpStatusCode }, false);
      });
      break;
    }
  }

  TRANSIENT_ERROR_CODES.forEach((name) => {
    it(`should declare error with cause with the name "${name}" to be a Transient error`, () => {
      checkForErrorType(isTransientError, { cause: { name } }, true);
    });
  });

  it("should limit recursion to 10 depth", () => {
    const error = { cause: null } as unknown as SdkError;
    error.cause = error;
    checkForErrorType(isTransientError, { cause: error }, false);
  });

  NODEJS_TIMEOUT_ERROR_CODES.forEach((code) => {
    it(`should declare error with cause with the code "${code}" to be a Transient error`, () => {
      checkForErrorType(isTransientError, { code }, true);
    });
  });

  NODEJS_NETWORK_ERROR_CODES.forEach((code) => {
    it(`should declare error with cause with the code "${code}" to be a Transient error`, () => {
      checkForErrorType(isTransientError, { code }, true);
    });
  });
});

describe("isServerError", () => {
  [501, 505, 511].forEach((httpStatusCode) => {
    it(`should declare error with the HTTP Status Code "${httpStatusCode}" to be a Server error`, () => {
      checkForErrorType(isServerError, { httpStatusCode }, true);
    });
  });
  TRANSIENT_ERROR_STATUS_CODES.forEach((httpStatusCode) => {
    it(`should declare error with the HTTP Status Code "${httpStatusCode}" to not be be a Server error`, () => {
      checkForErrorType(isServerError, { httpStatusCode }, false);
    });
  });
});
