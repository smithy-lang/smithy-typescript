// smithy-typescript generated code
import {
  type ExceptionOptionType as __ExceptionOptionType,
  ServiceException as __BaseException,
} from "@smithy/core/client";

/**
 * Error shapes in a closure generate throwable classes extending the
 * generic ServiceException base, since types mode has no service.
 * @public
 */
export class BirdError extends __BaseException {
  readonly name = "BirdError" as const;
  readonly $fault = "client" as const;
  reason?: string | undefined;
  /**
   * @internal
   */
  constructor(opts: __ExceptionOptionType<BirdError, __BaseException>) {
    super({
      name: "BirdError",
      $fault: "client",
      ...opts,
    });
    Object.setPrototypeOf(this, BirdError.prototype);
    this.reason = opts.reason;
  }
}
