import { EventStreamSerde } from "@smithy/core/event-streams";
import { SerdeContext } from "@smithy/core/protocols";
import type {
  $ShapeDeserializer,
  $ShapeSerializer,
  EventStreamMarshaller,
  EventStreamSerdeContext,
  HttpResponse,
  StaticOperationSchema,
} from "@smithy/types";

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
  ): Promise<HttpResponse>;

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
