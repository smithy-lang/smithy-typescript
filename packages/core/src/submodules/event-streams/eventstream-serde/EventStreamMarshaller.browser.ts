import type {
  Decoder,
  Encoder,
  EventSigner,
  EventStreamMarshaller as IEventStreamMarshaller,
  EventStreamSerdeProvider,
  Message,
  Provider,
} from "@smithy/types";

import { EventStreamMarshaller as UniversalEventStreamMarshaller } from "../eventstream-serde-universal/EventStreamMarshaller";
import { iterableToReadableStream, readableStreamToIterable } from "./utils";

/**
 * @internal
 */
export interface EventStreamMarshallerOptions {
  utf8Encoder: Encoder;
  utf8Decoder: Decoder;
}

/**
 * Utility class used to serialize and deserialize event streams in
 * browsers and ReactNative.
 *
 * In browsers where ReadableStream API is available:
 * * deserialize from ReadableStream to an async iterable of output structure
 * * serialize from async iterable of input structure to ReadableStream
 * In ReactNative where only async iterable API is available:
 * * deserialize from async iterable of binaries to async iterable of output structure
 * * serialize from async iterable of input structure to async iterable of binaries
 *
 * We use ReadableStream API in browsers because of the consistency with other
 * streaming operations, where ReadableStream API is used to denote streaming data.
 * Whereas in ReactNative, ReadableStream API is not available, we use async iterable
 * for streaming data, although it has lower throughput.
 *
 * @internal
 */
export class EventStreamMarshaller implements IEventStreamMarshaller {
  private readonly universalMarshaller: UniversalEventStreamMarshaller;
  constructor({ utf8Encoder, utf8Decoder }: EventStreamMarshallerOptions) {
    this.universalMarshaller = new UniversalEventStreamMarshaller({
      utf8Decoder,
      utf8Encoder,
    });
  }

  deserialize<T>(
    body: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>,
    deserializer: (input: Record<string, Message>) => Promise<T>
  ): AsyncIterable<T> {
    const bodyIterable = isReadableStream(body) ? readableStreamToIterable(body) : body;
    return this.universalMarshaller.deserialize(bodyIterable, deserializer);
  }

  /**
   * Generate a stream that serialize events into stream of binary chunks;
   *
   * Caveat is that streaming request payload doesn't work on browser with native
   * xhr or fetch handler currently because they don't support upload streaming.
   * reference:
   * * https://bugs.chromium.org/p/chromium/issues/detail?id=688906
   * * https://bugzilla.mozilla.org/show_bug.cgi?id=1387483
   *
   */
  serialize<T>(input: AsyncIterable<T>, serializer: (event: T) => Message): ReadableStream | AsyncIterable<Uint8Array> {
    const serializedIterable = this.universalMarshaller.serialize(input, serializer);
    return typeof ReadableStream === "function" ? iterableToReadableStream(serializedIterable) : serializedIterable;
  }
}

/**
 * Warning: do not export this without aliasing the reference to
 * global ReadableStream.
 * @internal
 * @see https://github.com/smithy-lang/smithy-typescript/issues/1341.
 */
const isReadableStream = (body: any): body is ReadableStream =>
  typeof ReadableStream === "function" && body instanceof ReadableStream;

/**
 * @internal
 */
export const eventStreamSerdeProvider: EventStreamSerdeProvider = (options: {
  utf8Encoder: Encoder;
  utf8Decoder: Decoder;
  eventSigner: EventSigner | Provider<EventSigner>;
}) => new EventStreamMarshaller(options);
