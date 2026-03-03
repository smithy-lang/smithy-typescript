// smithy-typescript generated code
import type { NumericValue } from "@smithy/core/serde";

/**
 * @public
 */
export interface HttpLabelCommandInput {
  LabelDoesNotApplyToRpcProtocol: string | undefined;
}

/**
 * @public
 */
export interface HttpLabelCommandOutput {}

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
export interface CamelCaseOperationInput {
  token?: string | undefined;
}

/**
 * @public
 */
export interface CamelCaseOperationOutput {
  token?: string | undefined;
  results?: Uint8Array[] | undefined;
}

/**
 * @public
 */
export interface GetNumbersRequest {
  bigDecimal?: NumericValue | undefined;
  bigInteger?: bigint | undefined;
  /**
   * This is deprecated documentation annotation.
   *
   * @deprecated deprecated.
   * @public
   */
  fieldWithoutMessage?: string | undefined;

  /**
   * This is deprecated documentation annotation.
   *
   * @deprecated (since 3.0) This field has been deprecated.
   * @public
   */
  fieldWithMessage?: string | undefined;

  startToken?: string | undefined;
  maxResults?: number | undefined;
}

/**
 * @public
 */
export interface GetNumbersResponse {
  bigDecimal?: NumericValue | undefined;
  bigInteger?: bigint | undefined;
  numbers?: number[] | undefined;
  nextToken?: string | undefined;
  /**
   * This is deprecated documentation annotation.
   *
   * @deprecated (since 1685-12-31) these numbers are not used anymore.
   * @public
   */
  deprecatedNumbers?: number[] | undefined;

  /**
   * This is deprecated documentation annotation.
   *
   * @deprecated since 1685-12-31.
   * @public
   */
  deprecatedNumbersWithoutExplanation?: number[] | undefined;

  /**
   * @deprecated these numbers are not used anymore??
   * @public
   */
  deprecatedNumbersWithoutChronology?: number[] | undefined;

  /**
   * @deprecated deprecated.
   * @public
   */
  inexplicablyDeprecatedNumbers?: number[] | undefined;
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

  /**
   * @deprecated unused in schema-serde mode.
   *
   */
  export interface Visitor<T> {
    alpha: (value: Alpha) => T;
    beta: (value: Unit) => T;
    gamma: (value: Unit) => T;
    _: (name: string, value: any) => T;
  }
}

/**
 * @public
 */
export interface TradeEventStreamRequest {
  eventStream?: AsyncIterable<TradeEvents> | undefined;
}

/**
 * @public
 */
export interface TradeEventStreamResponse {
  eventStream?: AsyncIterable<TradeEvents> | undefined;
}
