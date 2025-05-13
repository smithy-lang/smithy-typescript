import {
  Endpoint,
  HandlerExecutionContext,
  Provider,
  RequestSerializer,
  SerdeContext,
  SerdeFunctions,
  SerializeHandler,
  SerializeHandlerArguments,
  SerializeHandlerOutput,
  SerializeMiddleware,
} from "@smithy/types";

import type { V1OrV2Endpoint } from "./serdePlugin";

/**
 * @internal
 */
export const serializerMiddleware =
  <Input extends object = any, Output extends object = any, CommandSerdeContext extends SerdeContext = any>(
    options: SerdeFunctions,
    serializer: RequestSerializer<any, CommandSerdeContext>
  ): SerializeMiddleware<Input, Output> =>
  (next: SerializeHandler<Input, Output>, context: HandlerExecutionContext): SerializeHandler<Input, Output> =>
  async (args: SerializeHandlerArguments<Input>): Promise<SerializeHandlerOutput<Output>> => {
    const endpointConfig = options as V1OrV2Endpoint;

    const endpoint: Provider<Endpoint> =
      context.endpointV2?.url && endpointConfig.urlParser
        ? async () => endpointConfig.urlParser!(context.endpointV2!.url as URL)
        : endpointConfig.endpoint!;

    if (!endpoint) {
      throw new Error("No valid endpoint provider available.");
    }

    /**
     * [options] is upgraded from SerdeFunctions to CommandSerdeContext,
     * since the generated serializer expects CommandSerdeContext.
     *
     * This is okay because options is from the same client's resolved config,
     * and `endpoint` has been provided here by checking two sources.
     */
    const request = await serializer(args.input, { ...options, endpoint } as CommandSerdeContext);

    return next({
      ...args,
      request,
    });
  };
