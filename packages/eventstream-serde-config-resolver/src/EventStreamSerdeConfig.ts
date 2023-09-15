import type { EventStreamMarshaller, EventStreamSerdeProvider } from "@smithy/types";

/**
 * @public
 */
export interface EventStreamSerdeInputConfig {}

/**
 * @internal
 */
export interface EventStreamSerdeResolvedConfig {
  eventStreamMarshaller: EventStreamMarshaller;
}

interface PreviouslyResolved {
  /**
   * Provide the event stream marshaller for the given runtime
   * @internal
   */
  eventStreamSerdeProvider: EventStreamSerdeProvider;
}

/**
 * @internal
 */
export const resolveEventStreamSerdeConfig = <T>(
  input: T & PreviouslyResolved & EventStreamSerdeInputConfig
): T & EventStreamSerdeResolvedConfig => ({
  ...input,
  eventStreamMarshaller: input.eventStreamSerdeProvider(input),
});
