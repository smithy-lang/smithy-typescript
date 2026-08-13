// smithy-typescript generated code
import { NumericValue } from "@smithy/core/serde";

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
  overloadedParam?: string | undefined;
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
export interface ConstrainedAddress {
  /**
   * Zip code must be exactly 5 digits.
   * @public
   */
  zipCode?: string | undefined;

  /**
   * State abbreviation must be exactly 2 characters.
   * @public
   */
  state?: string | undefined;
}

/**
 * @public
 */
export interface DifferentShapeName {
  name?: string | undefined;
  number?: number | undefined;
}

/**
 * @public
 */
export interface GammaPayload {
  message?: string | undefined;
  values?: number[] | undefined;
}

/**
 * @public
 */
export interface Gamma {
  sequenceNumber?: number | undefined;
  payload?: GammaPayload | undefined;
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
  customHeaderInput?: string | undefined;
  numbers?: Record<string, number> | undefined;
  sparseNumbers?: Record<string, number | null> | undefined;
}

/**
 * @public
 */
export interface GetNumbersResponse {
  bigDecimal?: NumericValue | undefined;
  bigInteger?: bigint | undefined;
  numbers?: number[] | undefined;
  sparseNumbers?: (number | null)[] | undefined;
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
export interface HeartbeatEvent {
  timestamp?: Date | undefined;
}

/**
 * @public
 */
export interface HostPrefixOperationInput {
  AccountId: string | undefined;
}

/**
 * @public
 */
export interface LogEvent {
  level?: string | undefined;
  message?: string | undefined;
}

/**
 * @public
 */
export interface MetricEvent {
  name?: string | undefined;
  value?: number | undefined;
}

/**
 * @public
 */
export interface NotificationEvent {
  topic?: string | undefined;
  payload?: string | undefined;
}

/**
 * @public
 */
export type PublishEventStream =
  | PublishEventStream.LogMember
  | PublishEventStream.MetricMember
  | PublishEventStream.$UnknownMember;

/**
 * @public
 */
export namespace PublishEventStream {
  export interface LogMember {
    log: LogEvent;
    metric?: never;
    $unknown?: never;
  }

  export interface MetricMember {
    log?: never;
    metric: MetricEvent;
    $unknown?: never;
  }

  /**
   * @public
   */
  export interface $UnknownMember {
    log?: never;
    metric?: never;
    $unknown: [string, any];
  }

  /**
   * @deprecated unused in schema-serde mode.
   *
   */
  export interface Visitor<T> {
    log: (value: LogEvent) => T;
    metric: (value: MetricEvent) => T;
    _: (name: string, value: any) => T;
  }
}

/**
 * @public
 */
export interface PublishEventsRequest {
  channel?: string | undefined;
  events?: AsyncIterable<PublishEventStream> | undefined;
}

/**
 * @public
 */
export interface PublishEventsResponse {
  eventCount?: number | undefined;
  message?: string | undefined;
}

/**
 * @public
 */
export type SubscribeEventStream =
  | SubscribeEventStream.HeartbeatMember
  | SubscribeEventStream.NotificationMember
  | SubscribeEventStream.$UnknownMember;

/**
 * @public
 */
export namespace SubscribeEventStream {
  export interface NotificationMember {
    notification: NotificationEvent;
    heartbeat?: never;
    $unknown?: never;
  }

  export interface HeartbeatMember {
    notification?: never;
    heartbeat: HeartbeatEvent;
    $unknown?: never;
  }

  /**
   * @public
   */
  export interface $UnknownMember {
    notification?: never;
    heartbeat?: never;
    $unknown: [string, any];
  }

  /**
   * @deprecated unused in schema-serde mode.
   *
   */
  export interface Visitor<T> {
    notification: (value: NotificationEvent) => T;
    heartbeat: (value: HeartbeatEvent) => T;
    _: (name: string, value: any) => T;
  }
}

/**
 * @public
 */
export interface SubscribeToEventsRequest {
  channel?: string | undefined;
  maxEvents?: number | undefined;
}

/**
 * @public
 */
export interface SubscribeToEventsResponse {
  subscriptionId?: string | undefined;
  events?: AsyncIterable<SubscribeEventStream> | undefined;
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
  | TradeEvents.DeltaMember
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
    delta?: never;
    $unknown?: never;
  }

  export interface BetaMember {
    alpha?: never;
    beta: Unit;
    gamma?: never;
    delta?: never;
    $unknown?: never;
  }

  export interface GammaMember {
    alpha?: never;
    beta?: never;
    gamma: Gamma;
    delta?: never;
    $unknown?: never;
  }

  export interface DeltaMember {
    alpha?: never;
    beta?: never;
    gamma?: never;
    delta: DifferentShapeName;
    $unknown?: never;
  }

  /**
   * @public
   */
  export interface $UnknownMember {
    alpha?: never;
    beta?: never;
    gamma?: never;
    delta?: never;
    $unknown: [string, any];
  }

  /**
   * @deprecated unused in schema-serde mode.
   *
   */
  export interface Visitor<T> {
    alpha: (value: Alpha) => T;
    beta: (value: Unit) => T;
    gamma: (value: Gamma) => T;
    delta: (value: DifferentShapeName) => T;
    _: (name: string, value: any) => T;
  }
}

/**
 * @public
 */
export interface TradeEventStreamRequest {
  sessionId?: string | undefined;
  eventStream?: AsyncIterable<TradeEvents> | undefined;
}

/**
 * @public
 */
export interface TradeEventStreamResponse {
  sessionId?: string | undefined;
  eventStream?: AsyncIterable<TradeEvents> | undefined;
}

/**
 * @public
 */
export interface ValidatedInput {
  /**
   * Must be between 1 and 100 characters.
   * @public
   */
  username?: string | undefined;

  /**
   * Must be between 1 and 150 (inclusive).
   * @public
   */
  age?: number | undefined;

  /**
   * Must match an email-like pattern.
   * @public
   */
  email?: string | undefined;

  /**
   * A list that must have between 1 and 5 items.
   * @public
   */
  tags?: string[] | undefined;

  /**
   * A list where each item must be unique.
   * @public
   */
  uniqueTags?: string[] | undefined;

  /**
   * Nested structure with its own constraints.
   * @public
   */
  address?: ConstrainedAddress | undefined;
}

/**
 * @public
 */
export interface ValidatedOutput {
  message?: string | undefined;
}
