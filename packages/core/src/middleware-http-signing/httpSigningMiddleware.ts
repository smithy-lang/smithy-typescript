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
interface HttpSigningMiddlewarePreviouslyResolved {
  systemClockOffset?: number;
}

/**
 * @internal
 */
export const httpSigningMiddleware = <Input extends object, Output extends object>(
  config: HttpSigningMiddlewarePreviouslyResolved
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
  const lastSystemClockOffset = config.systemClockOffset | 0;

  const makeSignedRequest = async () =>
    next({
      ...args,
      request: await signer.sign(args.request as HttpRequest, identity, signingProperties),
    });

  const onError = (signer.errorHandler || defaultErrorHandler)(signingProperties);
  const onSuccess = signer.successHandler || defaultSuccessHandler;

  const output = await makeSignedRequest().catch(async (error: unknown) => {
    let thrownError: unknown;
    try {
      onError(error as Error);
    } catch (e) {
      thrownError = e;
    }
    const latestSystemClockOffset = config.systemClockOffset | 0;
    const systemClockOffsetModified = lastSystemClockOffset !== latestSystemClockOffset;

    if (systemClockOffsetModified) {
      return makeSignedRequest().catch(onError);
    } else {
      if (thrownError) {
        throw thrownError;
      }
    }
  });
  onSuccess(output.response, signingProperties);
  return output;
};
