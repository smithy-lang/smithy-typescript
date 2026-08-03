import type {
  Decoder,
  Encoder,
  EventStreamMarshaller as IEventStreamMarshaller,
  EventStreamSerdeProvider,
  Message,
} from "@smithy/types";

/**
 * Options for {@link SseEventStreamMarshaller}. Mirrors the options of the
 * binary event stream marshaller so the two are interchangeable at the
 * codegen serde-context seam.
 *
 * @internal
 */
export interface SseEventStreamMarshallerOptions {
  utf8Encoder: Encoder;
  utf8Decoder: Decoder;
}

const EXCEPTION_PREFIX = "exception:";

/**
 * An {@link IEventStreamMarshaller} that frames Smithy event stream messages
 * as Server-Sent Events (`text/event-stream`) instead of the binary
 * `application/vnd.amazon.eventstream` encoding.
 *
 * Wire mapping:
 * - `:event-type` header -> SSE `event:` field
 * - message body         -> SSE `data:` field(s)
 * - modeled exceptions   -> SSE `event: exception:<code>`
 *
 * The serializer/deserializer callbacks use the same contract as the binary
 * marshaller: a `Record<string, Message>` keyed by event type on the way in,
 * a `Message` with `:event-type` / `:message-type` headers on the way out.
 *
 * @internal
 */
export class SseEventStreamMarshaller implements IEventStreamMarshaller<AsyncIterable<Uint8Array>> {
  private readonly utf8Encoder: Encoder;
  private readonly utf8Decoder: Decoder;

  constructor({ utf8Encoder, utf8Decoder }: SseEventStreamMarshallerOptions) {
    this.utf8Encoder = utf8Encoder;
    this.utf8Decoder = utf8Decoder;
  }

  public serialize<T>(input: AsyncIterable<T>, serializer: (event: T) => Message): AsyncIterable<Uint8Array> {
    const { utf8Decoder, utf8Encoder } = this;
    return {
      [Symbol.asyncIterator]: async function* () {
        for await (const event of input) {
          const message = serializer(event);
          const messageType = String(message.headers[":message-type"]?.value ?? "event");
          let eventName: string;
          if (messageType === "exception") {
            eventName = EXCEPTION_PREFIX + String(message.headers[":exception-type"]?.value ?? "UnknownError");
          } else {
            eventName = String(message.headers[":event-type"]?.value ?? "message");
          }
          const body = message.body.length ? utf8Encoder(message.body) : "";
          // Per the SSE spec, payloads containing line terminators (CRLF, CR, or LF)
          // are sent as repeated data: fields and rejoined with LF when parsed.
          const dataLines = body
            .split(/\r\n|\r|\n/)
            .map((line) => `data: ${line}`)
            .join("\n");
          yield utf8Decoder(`event: ${eventName}\n${dataLines}\n\n`);
        }
      },
    };
  }

  public deserialize<T>(
    body: AsyncIterable<Uint8Array>,
    deserializer: (input: Record<string, Message>) => Promise<T>
  ): AsyncIterable<T> {
    const { utf8Encoder, utf8Decoder } = this;
    return {
      [Symbol.asyncIterator]: async function* () {
        for await (const sse of parseSseStream(body, utf8Encoder)) {
          const isException = sse.event.startsWith(EXCEPTION_PREFIX);
          const type = isException ? sse.event.slice(EXCEPTION_PREFIX.length) : sse.event;
          const message: Message = {
            headers: {
              ":message-type": { type: "string", value: isException ? "exception" : "event" },
              [isException ? ":exception-type" : ":event-type"]: { type: "string", value: type },
              ":content-type": { type: "string", value: "application/json" },
            },
            body: utf8Decoder(sse.data),
          };
          const deserialized: any = await deserializer({ [type]: message });
          if (isException) {
            if (deserialized.$unknown) {
              const error = new Error(sse.data || "UnknownError");
              error.name = type;
              throw error;
            }
            throw deserialized[type];
          }
          if (deserialized.$unknown) {
            continue;
          }
          yield deserialized as T;
        }
      },
    };
  }
}

/**
 * @internal
 */
export const sseEventStreamSerdeProvider: EventStreamSerdeProvider = (options: SseEventStreamMarshallerOptions) =>
  new SseEventStreamMarshaller(options);

interface SseEvent {
  event: string;
  data: string;
}

/**
 * Incrementally parses a byte stream into SSE events per the WHATWG spec's
 * field rules: events are delimited by blank lines, `data:` fields accumulate
 * joined by newlines, comment lines (`:`) and unknown fields are ignored.
 */
async function* parseSseStream(source: AsyncIterable<Uint8Array>, toUtf8: Encoder): AsyncIterable<SseEvent> {
  let buffer = "";
  for await (const chunk of source) {
    buffer += toUtf8(chunk);
    let boundary: number;
    while ((boundary = findEventBoundary(buffer)) !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary).replace(/^(\r\n|\n|\r){2}/, "");
      const parsed = parseSseEvent(rawEvent);
      if (parsed !== undefined) {
        yield parsed;
      }
    }
  }
  const trailing = parseSseEvent(buffer);
  if (trailing !== undefined) {
    yield trailing;
  }
}

function findEventBoundary(buffer: string): number {
  const match = buffer.match(/(\r\n\r\n|\n\n|\r\r)/);
  return match?.index ?? -1;
}

function parseSseEvent(raw: string): SseEvent | undefined {
  let event = "message";
  const data: string[] = [];
  let sawField = false;
  for (const line of raw.split(/\r\n|\n|\r/)) {
    if (line === "" || line.startsWith(":")) {
      continue;
    }
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }
    if (field === "event") {
      event = value;
      sawField = true;
    } else if (field === "data") {
      data.push(value);
      sawField = true;
    }
    // id: and retry: fields are valid SSE but carry no Smithy meaning; ignored.
  }
  if (!sawField) {
    return undefined;
  }
  return { event, data: data.join("\n") };
}
