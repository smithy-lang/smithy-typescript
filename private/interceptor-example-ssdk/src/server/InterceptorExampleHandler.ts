// smithy-typescript generated code
import {
  type RequestIdentity,
  type SchemaServiceHandlerOptions,
  type ServerOperation,
  SchemaServiceHandler,
} from "@smithy/server-common";
import type { StaticOperationSchema } from "@smithy/types";

import type { GetItemInput, GetItemOutput, PingInput, PingOutput } from "../models/models_0";
import { GetItem$, Ping$ } from "../schemas/schemas_0";


const OPERATION_SCHEMAS: StaticOperationSchema[] = [
  GetItem$,
  Ping$,
];

export type InterceptorExampleHandlerOptions<
  Identity extends RequestIdentity = RequestIdentity,
  MetricsNative = unknown,
> = Omit<
  SchemaServiceHandlerOptions<Identity, MetricsNative>,
  "handlers" | "operationSchemas" | "protocols"
> & {
  handlers: {
    GetItem: ServerOperation<GetItemInput, GetItemOutput, Identity, MetricsNative>;
    Ping: ServerOperation<PingInput, PingOutput, Identity, MetricsNative>;
  };
  protocols: SchemaServiceHandlerOptions<Identity, MetricsNative>["protocols"];
};

/**
 * Creates the schema-based service handler for InterceptorExample.
 *
 * Generated operation schemas and modeled protocol defaults are supplied by
 * this facade. Applications provide business handlers and optional runtime
 * configuration.
 *
 */
export function createInterceptorExampleHandler<
  Identity extends RequestIdentity = RequestIdentity,
  MetricsNative = unknown,
>(
  options: InterceptorExampleHandlerOptions<Identity, MetricsNative>
): SchemaServiceHandler<Identity, MetricsNative> {
  const { protocols, ...runtimeOptions } = options;
  return new SchemaServiceHandler<Identity, MetricsNative>({
    ...runtimeOptions,
    validationEnabled: runtimeOptions.validationEnabled ?? false,
    operationSchemas: OPERATION_SCHEMAS,
    protocols,
  });
}
