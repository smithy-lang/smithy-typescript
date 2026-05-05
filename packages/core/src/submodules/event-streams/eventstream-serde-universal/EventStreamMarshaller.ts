import type {
  Decoder,
  Encoder,
  EventSigner,
  EventStreamMarshaller as IEventStreamMarshaller,
  EventStreamSerdeProvider,
  Message,
  Provider,
} from "@smithy/types";

import { EventStreamCodec } from "../eventstream-codec/EventStreamCodec";
import { MessageDecoderStream } from "../eventstream-codec/MessageDecoderStream";
import { MessageEncoderStream } from "../eventstream-codec/MessageEncoderStream";
import { SmithyMessageDecoderStream } from "../eventstream-codec/SmithyMessageDecoderStream";
import { SmithyMessageEncoderStream } from "../eventstream-codec/SmithyMessageEncoderStream";
import { getChunkedStream } from "./getChunkedStream";
import { getMessageUnmarshaller } from "./getUnmarshalledStream";

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
  private readonly eventStreamCodec: EventStreamCodec;
  private readonly utfEncoder: Encoder;

  constructor({ utf8Encoder, utf8Decoder }: EventStreamMarshallerOptions) {
    this.eventStreamCodec = new EventStreamCodec(utf8Encoder, utf8Decoder);
    this.utfEncoder = utf8Encoder;
  }

  deserialize<T>(
    body: AsyncIterable<Uint8Array>,
    deserializer: (input: Record<string, Message>) => Promise<T>
  ): AsyncIterable<T> {
    const inputStream = getChunkedStream(body);
    return new SmithyMessageDecoderStream<T>({
      messageStream: new MessageDecoderStream({ inputStream, decoder: this.eventStreamCodec }),
      deserializer: getMessageUnmarshaller<any>(deserializer, this.utfEncoder),
    });
  }

  serialize<T>(inputStream: AsyncIterable<T>, serializer: (event: T) => Message): AsyncIterable<Uint8Array> {
    return new MessageEncoderStream({
      messageStream: new SmithyMessageEncoderStream<T>({ inputStream, serializer }),
      encoder: this.eventStreamCodec,
      includeEndFrame: true,
    });
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
