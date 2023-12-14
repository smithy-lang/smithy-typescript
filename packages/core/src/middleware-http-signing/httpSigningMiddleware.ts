import { HttpRequest } from "@smithy/protocol-http";
import {
  ErrorHandler,
  EventStreamPayloadHandler,
  FinalizeHandler,
  FinalizeHandlerArguments,
  FinalizeHandlerOutput,
  FinalizeRequestMiddleware,
  HandlerExecutionContext,
  MetadataBearer,
  SelectedHttpAuthScheme,
  SMITHY_CONTEXT_KEY,
  SuccessHandler,
} from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

/**
 * @internal
 */
interface HttpSigningMiddlewareConfig {
  /**
   * @internal
   */
  eventStreamPayloadHandler?: EventStreamPayloadHandler;
}

/**
 * @internal
 */
interface HttpSigningMiddlewareSmithyContext extends Record<string, unknown> {
  selectedHttpAuthScheme?: SelectedHttpAuthScheme;
  /**
   * @internal
   */
  eventStream?: {
    input?: boolean;
  };
}

/**
 * @internal
 */
interface HttpSigningMiddlewareHandlerExecutionContext extends HandlerExecutionContext {
  [SMITHY_CONTEXT_KEY]?: HttpSigningMiddlewareSmithyContext;
}

/**
 * @internal
 */
const defaultErrorHandler: ErrorHandler = (signingProperties) => (error) => {
  throw error;
};

/**
 * @internal
 */
const defaultSuccessHandler: SuccessHandler = (
  httpResponse: unknown,
  signingProperties: Record<string, unknown>
): void => {};

/**
 * @internal
 */
const isEventStreamInputSupported = (
  smithyContext: HttpSigningMiddlewareSmithyContext,
  config: HttpSigningMiddlewareConfig
) => smithyContext?.eventStream?.input && config.eventStreamPayloadHandler;

/**
 * @internal
 */
export const httpSigningMiddleware = <Input extends object, Output extends object>(
  config: HttpSigningMiddlewareConfig
): FinalizeRequestMiddleware<Input, Output> => (
  next: FinalizeHandler<Input, Output>,
  context: HttpSigningMiddlewareHandlerExecutionContext
): FinalizeHandler<Input, Output> => async (
  args: FinalizeHandlerArguments<Input>
): Promise<FinalizeHandlerOutput<Output>> => {
  if (!HttpRequest.isInstance(args.request)) {
    return next(args);
  }

  const smithyContext: HttpSigningMiddlewareSmithyContext = getSmithyContext(context);
  const scheme = smithyContext.selectedHttpAuthScheme;
  if (!scheme) {
    throw new Error(`No HttpAuthScheme was selected: unable to sign request`);
  }
  const {
    httpAuthOption: { signingProperties = {} },
    identity,
    signer,
  } = scheme;
  // If the input is an event stream and has a handler, use the eventStreamPayloadHandler
  // right after signing the initial request.
  const wrappedNext: FinalizeHandler<Input, Output> = isEventStreamInputSupported(smithyContext, config)
    ? async (args) =>
        config.eventStreamPayloadHandler!.handle(next as FinalizeHandler<Input, Output & MetadataBearer>, args, context)
    : next;
  const output = await wrappedNext({
    ...args,
    request: await signer.sign(args.request, identity, signingProperties),
  }).catch((signer.errorHandler || defaultErrorHandler)(signingProperties));
  (signer.successHandler || defaultSuccessHandler)(output.response, signingProperties);
  return output;
};
