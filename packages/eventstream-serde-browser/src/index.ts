import { readableStreamToIterable } from "@smithy/core/event-streams";

/** @deprecated Use @smithy/core/event-streams instead. */
export { EventStreamMarshaller, eventStreamSerdeProvider, iterableToReadableStream } from "@smithy/core/event-streams";
export type { EventStreamMarshallerOptions } from "@smithy/core/event-streams";

/**
 * @deprecated capitalization typo.
 */
export const readableStreamtoIterable = readableStreamToIterable;
