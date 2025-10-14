import type {
  Endpoint,
  EndpointBearer,
  HandlerExecutionContext,
  Provider,
  SerializeHandler,
  SerializeHandlerArguments,
  StaticOperationSchema,
} from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

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

    const endpoint: Provider<Endpoint> =
      context.endpointV2?.url && config.urlParser
        ? async () => config.urlParser!(context.endpointV2!.url as URL)
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
