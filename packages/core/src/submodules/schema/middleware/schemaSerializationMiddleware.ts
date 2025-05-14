import {
  Endpoint,
  EndpointBearer,
  HandlerExecutionContext,
  OperationSchema as IOperationSchema,
  Provider,
  SerializeHandler,
  SerializeHandlerArguments,
} from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

import { PreviouslyResolved } from "./schema-middleware-types";

/**
 * @internal
 */
export const schemaSerializationMiddleware =
  (config: PreviouslyResolved) =>
  (next: SerializeHandler<any, any>, context: HandlerExecutionContext) =>
  async (args: SerializeHandlerArguments<any>) => {
    const { operationSchema } = getSmithyContext(context) as {
      operationSchema: IOperationSchema;
    };

    const endpoint: Provider<Endpoint> =
      context.endpointV2?.url && config.urlParser
        ? async () => config.urlParser!(context.endpointV2!.url as URL)
        : (config as unknown as EndpointBearer).endpoint!;

    const request = await config.protocol.serializeRequest(operationSchema, args.input, {
      ...config,
      ...context,
      endpoint,
    });
    return next({
      ...args,
      request,
    });
  };
