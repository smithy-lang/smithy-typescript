/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import {
  EventStreamCodec,
  MessageDecoderStream,
  MessageEncoderStream,
  SmithyMessageDecoderStream,
  SmithyMessageEncoderStream,
} from "@smithy/eventstream-codec";
import { Decoder, Encoder, EventStreamMarshaller as IEventStreamMarshaller, Message } from "@smithy/types";

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
      messageStream: new SmithyMessageEncoderStream({ inputStream, serializer }),
      encoder: this.eventStreamCodec,
      includeEndFrame: true,
    });
  }
}
