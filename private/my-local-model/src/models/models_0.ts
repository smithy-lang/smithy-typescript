// smithy-typescript generated code
import { XYZServiceServiceException as __BaseException } from "./XYZServiceServiceException";
import { NumericValue } from "@smithy/core/serde";
import { ExceptionOptionType as __ExceptionOptionType } from "@smithy/smithy-client";

/**
 * @public
 */
export interface Alpha {
  id?: string | undefined;
  timestamp?: Date | undefined;
}

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

/**
 * @public
 */
export interface Unit {}

/**
 * @public
 */
export type TradeEvents =
  | TradeEvents.AlphaMember
  | TradeEvents.BetaMember
  | TradeEvents.GammaMember
  | TradeEvents.$UnknownMember;

/**
 * @public
 */
export namespace TradeEvents {
  export interface AlphaMember {
    alpha: Alpha;
    beta?: never;
    gamma?: never;
    $unknown?: never;
  }

  export interface BetaMember {
    alpha?: never;
    beta: Unit;
    gamma?: never;
    $unknown?: never;
  }

  export interface GammaMember {
    alpha?: never;
    beta?: never;
    gamma: Unit;
    $unknown?: never;
  }

  /**
   * @public
   */
  export interface $UnknownMember {
    alpha?: never;
    beta?: never;
    gamma?: never;
    $unknown: [string, any];
  }

  export interface Visitor<T> {
    alpha: (value: Alpha) => T;
    beta: (value: Unit) => T;
    gamma: (value: Unit) => T;
    _: (name: string, value: any) => T;
  }

  export const visit = <T>(value: TradeEvents, visitor: Visitor<T>): T => {
    if (value.alpha !== undefined) return visitor.alpha(value.alpha);
    if (value.beta !== undefined) return visitor.beta(value.beta);
    if (value.gamma !== undefined) return visitor.gamma(value.gamma);
    return visitor._(value.$unknown[0], value.$unknown[1]);
  };
}
/**
 * @internal
 */
export const TradeEventsFilterSensitiveLog = (obj: TradeEvents): any => {
  if (obj.alpha !== undefined) return { alpha: obj.alpha };
  if (obj.beta !== undefined) return { beta: obj.beta };
  if (obj.gamma !== undefined) return { gamma: obj.gamma };
  if (obj.$unknown !== undefined) return { [obj.$unknown[0]]: "UNKNOWN" };
};

/**
 * @public
 */
export interface TradeEventStreamRequest {
  eventStream?: AsyncIterable<TradeEvents> | undefined;
}

/**
 * @internal
 */
export const TradeEventStreamRequestFilterSensitiveLog = (obj: TradeEventStreamRequest): any => ({
  ...obj,
  ...(obj.eventStream && { eventStream: "STREAMING_CONTENT" }),
});

/**
 * @public
 */
export interface TradeEventStreamResponse {
  eventStream?: AsyncIterable<TradeEvents> | undefined;
}

/**
 * @internal
 */
export const TradeEventStreamResponseFilterSensitiveLog = (obj: TradeEventStreamResponse): any => ({
  ...obj,
  ...(obj.eventStream && { eventStream: "STREAMING_CONTENT" }),
});
