import { NormalizedSchema, SCHEMA } from "@smithy/core/schema";
import type {
  EventStreamMarshaller,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  Message as EventStreamMessage,
  MessageHeaders,
  MessageHeaderValue,
  SerdeFunctions,
  ShapeDeserializer,
  ShapeSerializer,
} from "@smithy/types";
import { fromUtf8 } from "@smithy/util-utf8";

/**
 * Separated module for async mixin of EventStream serde capability.
 * This is used by the HttpProtocol base class from \@smithy/core/protocols.
 *
 * @alpha
 */
export class EventStreamSerde {
  private readonly marshaller: EventStreamMarshaller;
  private readonly serializer: ShapeSerializer<string | Uint8Array>;
  private readonly deserializer: ShapeDeserializer<string | Uint8Array>;
  private readonly serdeContext?: SerdeFunctions;
  private readonly defaultContentType: string;

  /**
   * Properties are injected by the HttpProtocol.
   */
  public constructor({
    marshaller,
    serializer,
    deserializer,
    serdeContext,
    defaultContentType,
  }: {
    marshaller: EventStreamMarshaller;
    serializer: ShapeSerializer<string | Uint8Array>;
    deserializer: ShapeDeserializer<string | Uint8Array>;
    serdeContext?: SerdeFunctions;
    defaultContentType: string;
  }) {
    this.marshaller = marshaller;
    this.serializer = serializer;
    this.deserializer = deserializer;
    this.serdeContext = serdeContext;
    this.defaultContentType = defaultContentType;
  }

  /**
   * @param eventStream - the iterable provided by the caller.
   * @param requestSchema - the schema of the event stream container (struct).
   * @param [initialRequest] - only provided if the initial-request is part of the event stream (RPC).
   *
   * @returns a stream suitable for the HTTP body of a request.
   */
  public async serializeEventStream({
    eventStream,
    requestSchema,
    initialRequest,
  }: {
    eventStream: AsyncIterable<any>;
    requestSchema: NormalizedSchema;
    initialRequest?: any;
  }): Promise<IHttpRequest["body"] | Uint8Array> {
    const marshaller = this.marshaller;
    const eventStreamMember = requestSchema.getEventStreamMember();
    const unionSchema = requestSchema.getMemberSchema(eventStreamMember);
    const memberSchemas = unionSchema.getMemberSchemas();

    const serializer = this.serializer;
    const defaultContentType = this.defaultContentType;

    const initialRequestMarker = Symbol("initialRequestMarker");

    const eventStreamIterable: AsyncIterable<any> = {
      async *[Symbol.asyncIterator]() {
        if (initialRequest) {
          const headers: MessageHeaders = {
            ":event-type": { type: "string", value: "initial-request" },
            ":message-type": { type: "string", value: "event" },
            ":content-type": { type: "string", value: defaultContentType },
          };
          serializer.write(requestSchema, initialRequest);
          const body = serializer.flush();
          yield {
            [initialRequestMarker]: true,
            headers,
            body,
          };
        }

        for await (const page of eventStream) {
          yield page;
        }
      },
    };

    return marshaller.serialize(eventStreamIterable, (event: any): EventStreamMessage => {
      if (event[initialRequestMarker]) {
        return {
          headers: event.headers,
          body: event.body,
        };
      }

      const unionMember =
        Object.keys(event).find((key) => {
          return key !== "__type";
        }) ?? "";
      const eventStreamSchema = memberSchemas[unionMember] ?? NormalizedSchema.of(SCHEMA.DOCUMENT);

      let messageSerialization: string | Uint8Array;
      let eventType = unionMember;

      if (eventStreamSchema.isStructSchema()) {
        serializer.write(eventStreamSchema, event[unionMember]);
        messageSerialization = serializer.flush();
      } else {
        // $unknown member
        const [type, value] = event[unionMember];
        eventType = type;
        serializer.write(NormalizedSchema.of(SCHEMA.DOCUMENT), value);
        messageSerialization = serializer.flush();
      }

      const body =
        typeof messageSerialization === "string"
          ? (this.serdeContext?.utf8Decoder ?? fromUtf8)(messageSerialization)
          : messageSerialization;

      const headers: MessageHeaders = {
        ":event-type": { type: "string", value: eventType },
        ":message-type": { type: "string", value: "event" },
        ":content-type": { type: "string", value: defaultContentType },
      };

      // additional trait-annotated event headers.
      if (eventStreamSchema.isStructSchema()) {
        for (const [memberName, memberSchema] of eventStreamSchema.structIterator()) {
          const isHeader = !!memberSchema.getMergedTraits().eventHeader;
          if (!isHeader) {
            continue;
          }
          const value = event[memberName];
          let type = "binary" as MessageHeaderValue["type"];
          if (memberSchema.isNumericSchema()) {
            if ((-2) ** 31 <= value && value <= 2 ** 31 - 1) {
              type = "integer";
            } else {
              type = "long";
            }
          } else if (memberSchema.isTimestampSchema()) {
            type = "timestamp";
          } else if (memberSchema.isStringSchema()) {
            type = "string";
          } else if (memberSchema.isBooleanSchema()) {
            type = "boolean";
          }

          if (isHeader && value != undefined) {
            headers[memberName] = {
              type,
              value,
            };
          }
        }
      }

      return {
        headers,
        body,
      };
    });
  }

  /**
   * @param response - http response from which to read the event stream.
   * @param unionSchema - schema of the event stream container (struct).
   * @param [initialResponseContainer] - provided and written to only if the initial response is part of the event stream (RPC).
   *
   * @returns the asyncIterable of the event stream for the end-user.
   */
  public async deserializeEventStream({
    response,
    responseSchema,
    initialResponseContainer,
  }: {
    response: IHttpResponse;
    responseSchema: NormalizedSchema;
    initialResponseContainer?: any;
  }): Promise<AsyncIterable<{ [key: string]: any; $unknown?: unknown }>> {
    const marshaller = this.marshaller;
    const eventStreamMember = responseSchema.getEventStreamMember();
    const unionSchema = responseSchema.getMemberSchema(eventStreamMember);
    const memberSchemas = unionSchema.getMemberSchemas();

    const initialResponseMarker = Symbol("initialResponseMarker");

    const asyncIterable = marshaller.deserialize(response.body, async (event) => {
      const unionMember =
        Object.keys(event).find((key) => {
          return key !== "__type";
        }) ?? "";

      if (unionMember === "initial-response") {
        const dataObject = await this.deserializer.read(responseSchema, event[unionMember].body);
        delete dataObject[eventStreamMember];
        return {
          [initialResponseMarker]: true,
          ...dataObject,
        };
      } else if (unionMember in memberSchemas) {
        const eventStreamSchema = memberSchemas[unionMember];
        return {
          [unionMember]: await this.deserializer.read(eventStreamSchema, event[unionMember].body),
        };
      } else {
        // todo(schema): This union convention is ignored by the event stream marshaller.
        // todo(schema): This should be returned to the user instead.
        // see "if (deserialized.$unknown) return;" in getUnmarshalledStream.ts
        return {
          $unknown: event,
        };
      }
    });

    const asyncIterator = asyncIterable[Symbol.asyncIterator]();
    const firstEvent = await asyncIterator.next();

    if (firstEvent.done) {
      return asyncIterable;
    }

    if (firstEvent.value?.[initialResponseMarker]) {
      // if the initial response is part of the event stream, we assume
      // that the response schema was provided because RpcProtocols are the only ones
      // that act in this way.
      if (!responseSchema) {
        throw new Error(
          "@smithy::core/protocols - initial-response event encountered in event stream but no response schema given."
        );
      }

      for (const [key, value] of Object.entries(firstEvent.value)) {
        initialResponseContainer[key] = value;
      }
    }

    return {
      async *[Symbol.asyncIterator]() {
        if (!firstEvent?.value?.[initialResponseMarker]) {
          yield firstEvent.value;
        }
        while (true) {
          const { done, value } = await asyncIterator.next();
          if (done) {
            break;
          }
          yield value;
        }
      },
    };
  }
}
