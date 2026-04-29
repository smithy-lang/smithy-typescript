import { EventStreamSerde } from "@smithy/core/event-streams";
import { SerdeContext } from "@smithy/core/protocols";
import { HttpResponse } from "@smithy/protocol-http";
import type {
  $ShapeDeserializer,
  $ShapeSerializer,
  EventStreamMarshaller,
  EventStreamSerdeContext,
  HttpResponse as IHttpResponse,
  StaticErrorSchema,
  StaticOperationSchema,
} from "@smithy/types";
import { Readable } from "node:stream";

import type { SnapshotServerProtocol } from "../snapshot-testing-types";

/**
 * @internal
 */
export abstract class SnapshotProtocol extends SerdeContext implements SnapshotServerProtocol {
  public abstract getShapeId(): string;

  public abstract getDefaultContentType(): string;

  public abstract serializeResponse<Output extends object>(
    operationSchema: StaticOperationSchema,
    output: Output
  ): Promise<IHttpResponse>;

  public abstract serializeErrorResponse<Output extends object>(
    errorSchema: StaticErrorSchema,
    output: Output
  ): Promise<IHttpResponse>;

  public async serializeGenericFrontendErrorResponse(): Promise<IHttpResponse> {
    return new HttpResponse({
      headers: {
        "content-type": "text/html",
      },
      statusCode: 500,
      body: Readable.from("An unmodeled error occurred in a front end layer."),
    });
  }

  protected getEventStreamSerde(
    serializer: $ShapeSerializer<string> | $ShapeSerializer,
    deserializer: $ShapeDeserializer<string> | $ShapeDeserializer
  ) {
    return new EventStreamSerde({
      marshaller: this.getEventStreamMarshaller(),
      serializer,
      deserializer,
      defaultContentType: this.getDefaultContentType(),
    });
  }

  protected getEventStreamMarshaller(): EventStreamMarshaller {
    const context = this.serdeContext as unknown as EventStreamSerdeContext;
    if (!context.eventStreamMarshaller) {
      throw new Error("@smithy/core - HttpProtocol: eventStreamMarshaller missing in serdeContext.");
    }
    return context.eventStreamMarshaller;
  }
}
