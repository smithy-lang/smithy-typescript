import { Message } from "@smithy/types";

/**
 * @internal
 */
export interface SmithyMessageDecoderStreamOptions<T> {
  readonly messageStream: AsyncIterable<Message>;
  readonly deserializer: (input: Message) => Promise<T | undefined>;
}

/**
 * @internal
 */
export class SmithyMessageDecoderStream<T> implements AsyncIterable<T> {
  private buffer = [] as T[];
  constructor(private readonly options: SmithyMessageDecoderStreamOptions<T>) {}

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return this.asyncIterator();
  }

  public unshift(item: T) {
    this.buffer.unshift(item);
  }

  public push(item: T) {
    this.buffer.push(item);
  }

  private async *asyncIterator() {
    for await (const message of this.options.messageStream) {
      while (this.buffer.length > 0) {
        yield this.buffer.shift() as Awaited<T>;
      }
      const deserialized = await this.options.deserializer(message);
      if (deserialized === undefined) continue;
      yield deserialized;
    }
  }
}
