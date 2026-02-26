import { CborCodec } from "@smithy/core/cbor";
import { NormalizedSchema } from "@smithy/core/schema";
import type { HttpResponse, StaticOperationSchema } from "@smithy/types";

import type { SnapshotServerProtocol } from "../snapshot-testing-types";
import { SnapshotProtocol } from "./SnapshotProtocol";

/**
 * @internal
 */
export class SmithyRpcV2CborSnapshotProtocol extends SnapshotProtocol implements SnapshotServerProtocol {
  private codec = new CborCodec();
  private serializer = this.codec.createSerializer();
  private deserializer = this.codec.createDeserializer();

  public getDefaultContentType(): string {
    return "application/cbor";
  }

  public getShapeId(): string {
    return "smithy.protocols#rpcv2Cbor";
  }

  public async serializeResponse(operationSchema: StaticOperationSchema, output: any): Promise<HttpResponse> {
    const $output = NormalizedSchema.of(operationSchema[5]);
    const eventStreamMember = $output.getEventStreamMember();

    const response: HttpResponse = {
      statusCode: 200,
      headers: {
        "smithy-protocol": "rpc-v2-cbor",
        "content-type": this.getDefaultContentType(),
      },
    };

    if (eventStreamMember) {
      const eventStreamSerde = this.getEventStreamSerde(this.serializer, this.deserializer);

      if (output[eventStreamMember]?.[Symbol.asyncIterator]) {
        response.body = await eventStreamSerde.serializeEventStream({
          eventStream: output[eventStreamMember],
          requestSchema: $output,
        });
      } else {
        response.body = {
          async *[Symbol.asyncIterator]() {},
        };
      }
    } else {
      const { serializer } = this;
      serializer.write($output, output);
      // refrain from wrapping in Readable so the snapshot can use object view on the bytes.
      response.body = serializer.flush();
    }

    return response;
  }
}
