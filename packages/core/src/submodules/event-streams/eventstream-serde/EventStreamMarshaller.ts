import { Readable } from "node:stream";
import type {
  Decoder,
  Encoder,
  EventSigner,
  EventStreamSerdeProvider,
  EventStreamMarshaller as IEventStreamMarshaller,
  Message,
  Provider,
} from "@smithy/types";

import { EventStreamMarshaller as UniversalEventStreamMarshaller } from "../eventstream-serde-universal/EventStreamMarshaller";

/**
 * @internal
 */
export interface EventStreamMarshallerOptions {
  utf8Encoder: Encoder;
  utf8Decoder: Decoder;
}

/**
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

  deserialize<T>(body: Readable, deserializer: (input: Record<string, Message>) => Promise<T>): AsyncIterable<T> {
    //should use stream[Symbol.asyncIterable] when the api is stable
    //reference: https://nodejs.org/docs/latest-v11.x/api/stream.html#stream_readable_symbol_asynciterator
    const bodyIterable: AsyncIterable<Uint8Array> =
      typeof body[Symbol.asyncIterator] === "function" ? body : readableToIterable(body);
    return this.universalMarshaller.deserialize(bodyIterable, deserializer);
  }

  serialize<T>(input: AsyncIterable<T>, serializer: (event: T) => Message): Readable {
    return Readable.from(this.universalMarshaller.serialize(input, serializer));
  }
}

/**
 * @internal
 */
export const eventStreamSerdeProvider: EventStreamSerdeProvider = (options: {
  utf8Encoder: Encoder;
  utf8Decoder: Decoder;
  eventSigner: EventSigner | Provider<EventSigner>;
}) => new EventStreamMarshaller(options);

/**
 * Convert object stream piped in into an async iterable. This
 * adaptor should be deprecated when Node stream iterator is stable.
 * Caveat: this adaptor won't have backpressure to inwards stream
 *
 * Reference: https://nodejs.org/docs/latest-v11.x/api/stream.html#stream_readable_symbol_asynciterator
 * @internal
 */
export async function* readableToIterable<T>(readStream: Readable): AsyncIterable<T> {
  let streamEnded = false;
  let generationEnded = false;
  const records = new Array<T>();

  readStream.on("error", (err) => {
    if (!streamEnded) {
      streamEnded = true;
    }
    if (err) {
      throw err;
    }
  });

  readStream.on("data", (data) => {
    records.push(data);
  });

  readStream.on("end", () => {
    streamEnded = true;
  });

  while (!generationEnded) {
    // @ts-ignore TS2345: Argument of type 'T | undefined' is not assignable to type 'T | PromiseLike<T>'.
    const value = await new Promise<T>((resolve) => setTimeout(() => resolve(records.shift()), 0));
    if (value) {
      yield value;
    }
    generationEnded = streamEnded && records.length === 0;
  }
}
