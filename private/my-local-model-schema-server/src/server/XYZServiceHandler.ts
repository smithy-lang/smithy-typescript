// smithy-typescript generated code
import {
  type SchemaServiceHandlerOptions,
  type ServerRequestContext,
  SchemaServiceHandler,
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
  TradeEventStreamRequest,
  TradeEventStreamResponse,
  Unit,
  ValidatedInput,
  ValidatedOutput,
} from "../models/models_0";
import {
  camelCaseOperation$,
  GetNumbers$,
  HostPrefixOperation$,
  HttpLabelCommand$,
  TradeEventStream$,
  ValidatedOperation$,
} from "../schemas/schemas_0";


const OPERATION_SCHEMAS: StaticOperationSchema[] = [
  HttpLabelCommand$,
  camelCaseOperation$,
  GetNumbers$,
  HostPrefixOperation$,
  TradeEventStream$,
  ValidatedOperation$,
];

/**
 * Schema-based service handler for XYZService.
 * Extends SchemaServiceHandler which provides protocol resolution, routing,
 * metrics, auth, and interceptor support.
 *
 */
export class XYZServiceHandler<Context = {}> extends SchemaServiceHandler<Context> {
  constructor(options: SchemaServiceHandlerOptions<Context> & {
    handlers: {
      HttpLabelCommand: (input: HttpLabelCommandInput, context: ServerRequestContext, userContext: Context) => Promise<HttpLabelCommandOutput>;
      camelCaseOperation: (input: CamelCaseOperationInput, context: ServerRequestContext, userContext: Context) => Promise<CamelCaseOperationOutput>;
      GetNumbers: (input: GetNumbersRequest, context: ServerRequestContext, userContext: Context) => Promise<GetNumbersResponse>;
      HostPrefixOperation: (input: HostPrefixOperationInput, context: ServerRequestContext, userContext: Context) => Promise<Unit>;
      TradeEventStream: (input: TradeEventStreamRequest, context: ServerRequestContext, userContext: Context) => Promise<TradeEventStreamResponse>;
      ValidatedOperation: (input: ValidatedInput, context: ServerRequestContext, userContext: Context) => Promise<ValidatedOutput>;
    };
  }) {
    super({ ...options, validationEnabled: options.validationEnabled ?? true, operationSchemas: options.operationSchemas ?? OPERATION_SCHEMAS });
  }

}
