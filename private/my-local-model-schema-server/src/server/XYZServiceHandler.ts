// smithy-typescript generated code
import type { HttpRequest, HttpResponse } from "@smithy/core/protocols";
import { type SchemaServiceHandlerOptions, SchemaServiceHandler } from "@smithy/server-common";
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


const OPERATION_SCHEMAS: Record<string, StaticOperationSchema> = {
  "HttpLabelCommand": HttpLabelCommand$,
  "camelCaseOperation": camelCaseOperation$,
  "GetNumbers": GetNumbers$,
  "HostPrefixOperation": HostPrefixOperation$,
  "TradeEventStream": TradeEventStream$,
  "ValidatedOperation": ValidatedOperation$,
} as const;

/**
 * Schema-based service handler for XYZService.
 * Extends SchemaServiceHandler which provides protocol resolution, routing,
 * metrics, auth, and interceptor support.
 *
 */
export class XYZServiceHandler<Context = {}> extends SchemaServiceHandler<Context> {
  constructor(options: {
    protocols: SchemaServiceHandlerOptions<Context>["protocols"];
    handlers: {
      HttpLabelCommand: (input: HttpLabelCommandInput, context: Context) => Promise<HttpLabelCommandOutput>;
      camelCaseOperation: (input: CamelCaseOperationInput, context: Context) => Promise<CamelCaseOperationOutput>;
      GetNumbers: (input: GetNumbersRequest, context: Context) => Promise<GetNumbersResponse>;
      HostPrefixOperation: (input: HostPrefixOperationInput, context: Context) => Promise<Unit>;
      TradeEventStream: (input: TradeEventStreamRequest, context: Context) => Promise<TradeEventStreamResponse>;
      ValidatedOperation: (input: ValidatedInput, context: Context) => Promise<ValidatedOutput>;
    };
    router?: SchemaServiceHandlerOptions<Context>["router"];
  }) {
    super(options);
  }

  protected getOperationSchemas(): Record<string, StaticOperationSchema> {
    return OPERATION_SCHEMAS;
  }
}
