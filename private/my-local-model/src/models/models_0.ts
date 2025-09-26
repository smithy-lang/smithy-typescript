// smithy-typescript generated code
import { XYZServiceServiceException as __BaseException } from "./XYZServiceServiceException";
import { NumericValue } from "@smithy/core/serde";
import { ExceptionOptionType as __ExceptionOptionType } from "@smithy/smithy-client";

/**
 * @public
 */
export class CodedThrottlingError extends __BaseException {
  readonly name: "CodedThrottlingError" = "CodedThrottlingError";
  readonly $fault: "client" = "client";
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
export interface GetNumbersRequest {
  bigDecimal?: NumericValue | undefined;
  bigInteger?: bigint | undefined;
}

/**
 * @public
 */
export interface GetNumbersResponse {
  bigDecimal?: NumericValue | undefined;
  bigInteger?: bigint | undefined;
}

/**
 * @public
 */
export class HaltError extends __BaseException {
  readonly name: "HaltError" = "HaltError";
  readonly $fault: "client" = "client";
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
  readonly name: "MysteryThrottlingError" = "MysteryThrottlingError";
  readonly $fault: "client" = "client";
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
  readonly name: "RetryableError" = "RetryableError";
  readonly $fault: "client" = "client";
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
