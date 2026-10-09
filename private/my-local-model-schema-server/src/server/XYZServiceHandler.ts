// smithy-typescript generated code
import {
  type RequestIdentity,
  type SchemaServiceHandlerOptions,
  type ServerOperation,
  SchemaServiceHandler,
  SmithyRpcV2CborServerProtocol,
} from "@smithy/server-common";
import type { StaticOperationSchema } from "@smithy/types";

import type {
  CamelCaseOperationInput,
  CamelCaseOperationOutput,
  GetNumbersRequest,
  GetNumbersResponse,
  HostPrefixOperationInput,
  HttpLabelCommandInput,
  HttpLabelCommandOutput,
  PublishEventsRequest,
  PublishEventsResponse,
  SubscribeToEventsRequest,
  SubscribeToEventsResponse,
  TradeEventStreamRequest,
  TradeEventStreamResponse,
  UnionMemberCollisionInput,
  UnionMemberCollisionOutput,
  Unit,
  ValidatedInput,
  ValidatedOutput,
} from "../models/models_0";
import {
  camelCaseOperation$,
  GetNumbers$,
  HostPrefixOperation$,
  HttpLabelCommand$,
  PublishEvents$,
  SubscribeToEvents$,
  TradeEventStream$,
  UnionMemberCollisionOperation$,
  ValidatedOperation$,
} from "../schemas/schemas_0";


const OPERATION_SCHEMAS: StaticOperationSchema[] = [
  HttpLabelCommand$,
  camelCaseOperation$,
  GetNumbers$,
  HostPrefixOperation$,
  PublishEvents$,
  SubscribeToEvents$,
  TradeEventStream$,
  UnionMemberCollisionOperation$,
  ValidatedOperation$,
];

const createGeneratedProtocolDefaults = () => [
  new SmithyRpcV2CborServerProtocol({ defaultNamespace: "org.xyz.v1" }),
];

export type XYZServiceHandlerOptions<
  Identity extends RequestIdentity = RequestIdentity,
  MetricsNative = unknown,
> = Omit<
  SchemaServiceHandlerOptions<Identity, MetricsNative>,
  "handlers" | "operationSchemas" | "protocols"
> & {
  handlers: {
    HttpLabelCommand: ServerOperation<HttpLabelCommandInput, HttpLabelCommandOutput, Identity, MetricsNative>;
    camelCaseOperation: ServerOperation<CamelCaseOperationInput, CamelCaseOperationOutput, Identity, MetricsNative>;
    GetNumbers: ServerOperation<GetNumbersRequest, GetNumbersResponse, Identity, MetricsNative>;
    HostPrefixOperation: ServerOperation<HostPrefixOperationInput, Unit, Identity, MetricsNative>;
    PublishEvents: ServerOperation<PublishEventsRequest, PublishEventsResponse, Identity, MetricsNative>;
    SubscribeToEvents: ServerOperation<SubscribeToEventsRequest, SubscribeToEventsResponse, Identity, MetricsNative>;
    TradeEventStream: ServerOperation<TradeEventStreamRequest, TradeEventStreamResponse, Identity, MetricsNative>;
    UnionMemberCollisionOperation: ServerOperation<UnionMemberCollisionInput, UnionMemberCollisionOutput, Identity, MetricsNative>;
    ValidatedOperation: ServerOperation<ValidatedInput, ValidatedOutput, Identity, MetricsNative>;
  };
  protocols?: SchemaServiceHandlerOptions<Identity, MetricsNative>["protocols"];
};

/**
 * Creates the schema-based service handler for XYZService.
 *
 * Generated operation schemas and modeled protocol defaults are supplied by
 * this facade. Applications provide business handlers and optional runtime
 * configuration.
 *
 */
export function createXYZServiceHandler<
  Identity extends RequestIdentity = RequestIdentity,
  MetricsNative = unknown,
>(
  options: XYZServiceHandlerOptions<Identity, MetricsNative>
): SchemaServiceHandler<Identity, MetricsNative> {
  const { protocols, ...runtimeOptions } = options;
  return new SchemaServiceHandler<Identity, MetricsNative>({
    ...runtimeOptions,
    validationEnabled: runtimeOptions.validationEnabled ?? true,
    operationSchemas: OPERATION_SCHEMAS,
    protocols: protocols ?? createGeneratedProtocolDefaults(),
  });
}
