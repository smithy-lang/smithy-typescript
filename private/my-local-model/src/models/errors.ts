// smithy-typescript generated code
import type { ExceptionOptionType as __ExceptionOptionType } from "@smithy/smithy-client";

import { XYZServiceSyntheticServiceException as __BaseException } from "./XYZServiceSyntheticServiceException";

/**
 * @public
 */
export class MainServiceLinkedError extends __BaseException {
  readonly name = "MainServiceLinkedError" as const;
  readonly $fault = "client" as const;
  /**
   * @internal
   */
  constructor(opts: __ExceptionOptionType<MainServiceLinkedError, __BaseException>) {
    super({
      name: "MainServiceLinkedError",
      $fault: "client",
      ...opts,
    });
    Object.setPrototypeOf(this, MainServiceLinkedError.prototype);
  }
}

/**
 * @public
 */
export class CodedThrottlingError extends __BaseException {
  readonly name = "CodedThrottlingError" as const;
  readonly $fault = "client" as const;
  $retryable = {
    throttling: true,
  };
  /**
   * @internal
   */
  constructor(opts: __ExceptionOptionType<CodedThrottlingError, __BaseException>) {
    super({
      name: "CodedThrottlingError",
      $fault: "client",
      ...opts,
    });
    Object.setPrototypeOf(this, CodedThrottlingError.prototype);
  }
}

/**
 * @public
 */
export class HaltError extends __BaseException {
  readonly name = "HaltError" as const;
  readonly $fault = "client" as const;
  /**
   * @internal
   */
  constructor(opts: __ExceptionOptionType<HaltError, __BaseException>) {
    super({
      name: "HaltError",
      $fault: "client",
      ...opts,
    });
    Object.setPrototypeOf(this, HaltError.prototype);
  }
}

/**
 * @public
 */
export class MysteryThrottlingError extends __BaseException {
  readonly name = "MysteryThrottlingError" as const;
  readonly $fault = "client" as const;
  $retryable = {
    throttling: true,
  };
  /**
   * @internal
   */
  constructor(opts: __ExceptionOptionType<MysteryThrottlingError, __BaseException>) {
    super({
      name: "MysteryThrottlingError",
      $fault: "client",
      ...opts,
    });
    Object.setPrototypeOf(this, MysteryThrottlingError.prototype);
  }
}

/**
 * @public
 */
export class RetryableError extends __BaseException {
  readonly name = "RetryableError" as const;
  readonly $fault = "client" as const;
  $retryable = {};
  /**
   * @internal
   */
  constructor(opts: __ExceptionOptionType<RetryableError, __BaseException>) {
    super({
      name: "RetryableError",
      $fault: "client",
      ...opts,
    });
    Object.setPrototypeOf(this, RetryableError.prototype);
  }
}

/**
 * @public
 */
export class XYZServiceServiceException extends __BaseException {
  readonly name = "XYZServiceServiceException" as const;
  readonly $fault = "client" as const;
  /**
   * @internal
   */
  constructor(opts: __ExceptionOptionType<XYZServiceServiceException, __BaseException>) {
    super({
      name: "XYZServiceServiceException",
      $fault: "client",
      ...opts,
    });
    Object.setPrototypeOf(this, XYZServiceServiceException.prototype);
  }
}
