import { JsonCodec2 } from "@smithy/core/protocols";
import { NormalizedSchema } from "@smithy/core/schema";
import type { HttpResponse, StaticErrorSchema, StaticOperationSchema } from "@smithy/types";

import type { SnapshotServerProtocol } from "../snapshot-testing-types";
import { SnapshotProtocol } from "./SnapshotProtocol";

/**
 * JSON settings for Smithy RPCv2 JSON.
 *
 * Timestamps are always epoch-seconds and the `timestampFormat` trait is not
 * respected (`useTrait: false`), per the spec. Property names match member
 * names exactly (`jsonName: false`).
 *
 * @internal
 */
const RPC_V2_JSON_SETTINGS = {
  timestampFormat: {
    useTrait: false,
    default: 7 as const, // epoch-seconds
  },
  jsonName: false,
  // RPCv2 JSON serializes bigInteger/bigDecimal as JSON strings (SEP).
  bigNumberAsString: true,
} as const;

/**
 * @internal
 */
export class SmithyRpcV2JsonSnapshotProtocol extends SnapshotProtocol implements SnapshotServerProtocol {
  private codec = new JsonCodec2(RPC_V2_JSON_SETTINGS);
  private serializer = this.codec.createSerializer();
  private deserializer = this.codec.createDeserializer();

  public getDefaultContentType(): string {
    return "application/json";
  }

  public getShapeId(): string {
    return "smithy.protocols#rpcv2Json";
  }

  public async serializeResponse(operationSchema: StaticOperationSchema, output: any): Promise<HttpResponse> {
    const $output = NormalizedSchema.of(operationSchema[5]);
    const eventStreamMember = $output.getEventStreamMember();

    const response: HttpResponse = {
      statusCode: 200,
      headers: {
        "smithy-protocol": "rpc-v2-json",
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
      response.body = serializer.flush();
    }

    return response;
  }

  public async serializeErrorResponse<Output extends object>(
    errorSchema: StaticErrorSchema,
    output: Output
  ): Promise<HttpResponse> {
    const $error = NormalizedSchema.of(errorSchema);
    const clientFault = $error.getMergedTraits().error !== "server";
    const httpError = $error.getMergedTraits().httpError;
    const status = Number(typeof httpError === "number" ? httpError : clientFault ? 400 : 500);

    const response: HttpResponse = {
      statusCode: status,
      headers: {
        "smithy-protocol": "rpc-v2-json",
        "content-type": this.getDefaultContentType(),
      },
    };

    const { serializer } = this;

    Object.assign(output, {
      __type: $error.getName(true),
    });
    serializer.write($error, output);
    response.body = serializer.flush();

    return response;
  }
}
