import { HttpRequest } from "@smithy/protocol-http";
import {
  ErrorHandler,
  FinalizeHandler,
  FinalizeHandlerArguments,
  FinalizeHandlerOutput,
  FinalizeRequestMiddleware,
  HandlerExecutionContext,
  SelectedHttpAuthScheme,
  SMITHY_CONTEXT_KEY,
  SuccessHandler,
} from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

/**
 * @internal
 */
interface HttpSigningMiddlewareSmithyContext extends Record<string, unknown> {
  selectedHttpAuthScheme?: SelectedHttpAuthScheme;
}

/**
 * @internal
 */
interface HttpSigningMiddlewareHandlerExecutionContext extends HandlerExecutionContext {
  [SMITHY_CONTEXT_KEY]?: HttpSigningMiddlewareSmithyContext;
}

const defaultErrorHandler: ErrorHandler = (signingProperties) => (error) => {
  throw error;
};

const defaultSuccessHandler: SuccessHandler = (
  httpResponse: unknown,
  signingProperties: Record<string, unknown>
): void => {};

/**
 * @internal
 */
export const httpSigningMiddleware = <Input extends object, Output extends object>(
  config: object
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
  const output = await next({
    ...args,
    request: await signer.sign(args.request, identity, signingProperties),
  }).catch((signer.errorHandler || defaultErrorHandler)(signingProperties));
  (signer.successHandler || defaultSuccessHandler)(output.response, signingProperties);
  return output;
};
