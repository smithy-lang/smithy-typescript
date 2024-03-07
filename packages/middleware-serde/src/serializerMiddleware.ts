import {
  HandlerExecutionContext,
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
 *
 * Note: 3rd type parameter is deprecated and unused.
 */
export const serializerMiddleware = <Input extends object, Output extends object, CommandSerdeContext extends SerdeContext = any>(
  options: V1OrV2Endpoint & SerdeFunctions,
  serializer: RequestSerializer<any, CommandSerdeContext>
): SerializeMiddleware<Input, Output> => (
  next: SerializeHandler<Input, Output>,
  context: HandlerExecutionContext
): SerializeHandler<Input, Output> => async (
  args: SerializeHandlerArguments<Input>
): Promise<SerializeHandlerOutput<Output>> => {
  const endpoint =
    context.endpointV2?.url && options.urlParser
      ? async () => options.urlParser!(context.endpointV2!.url as URL)
      : options.endpoint!;

  if (!endpoint) {
    throw new Error("No valid endpoint provider available.");
  }

  const request = await serializer(args.input, { ...options, endpoint } as CommandSerdeContext);

  return next({
    ...args,
    request,
  });
};
