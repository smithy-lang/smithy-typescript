import { getSmithyContext } from "@smithy/core/client";
import { toEndpointV1 } from "@smithy/core/endpoints";
import type {
  EndpointBearer,
  HandlerExecutionContext,
  SerializeHandler,
  SerializeHandlerArguments,
  StaticOperationSchema,
} from "@smithy/types";

import { operation } from "../schemas/operation";
import type { PreviouslyResolved } from "./schema-middleware-types";

/**
 * @internal
 */
export const schemaSerializationMiddleware =
  (config: PreviouslyResolved) =>
  (next: SerializeHandler<any, any>, context: HandlerExecutionContext) =>
  async (args: SerializeHandlerArguments<any>) => {
    const { operationSchema } = getSmithyContext(context) as {
      operationSchema: StaticOperationSchema;
    };
    const [, ns, n, t, i, o] = operationSchema ?? [];

    const endpoint = context.endpointV2
      ? async () => toEndpointV1(context.endpointV2!)
      : (config as unknown as EndpointBearer).endpoint!;

    const request = await config.protocol.serializeRequest(operation(ns, n, t, i, o), args.input, {
      ...config,
      ...context,
      endpoint,
    });
    return next({
      ...args,
      request,
    });
  };
