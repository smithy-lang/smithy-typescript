import { EventStreamMarshaller, EventStreamSerdeProvider } from "@smithy/types";

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

/**
 * @internal
 */
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
): T & EventStreamSerdeResolvedConfig =>
  Object.assign(input, {
    eventStreamMarshaller: input.eventStreamSerdeProvider(input),
  });
