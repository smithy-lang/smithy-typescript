import { HttpRequest } from "@smithy/protocol-http";
import {
  FinalizeHandler,
  FinalizeHandlerArguments,
  FinalizeHandlerOutput,
  FinalizeRequestMiddleware,
  HandlerExecutionContext,
  SMITHY_CONTEXT_KEY,
} from "@smithy/types";
import { getSmithyContext } from "@smithy/util-middleware";

import { SelectedHttpAuthScheme } from "../HttpAuthScheme";

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

/**
 * @internal
 */
export const httpSigningMiddleware =
  <Input extends object, Output extends object>(config: object): FinalizeRequestMiddleware<Input, Output> =>
  (
    next: FinalizeHandler<Input, Output>,
    context: HttpSigningMiddlewareHandlerExecutionContext
  ): FinalizeHandler<Input, Output> =>
  async (args: FinalizeHandlerArguments<Input>): Promise<FinalizeHandlerOutput<Output>> => {
    if (!HttpRequest.isInstance(args.request)) {
      return next(args);
    }

    const smithyContext: HttpSigningMiddlewareSmithyContext = getSmithyContext(context);
    const scheme = smithyContext.selectedHttpAuthScheme;
    if (!scheme) {
      throw new Error(`No HttpAuthScheme was selected: unable to sign request`);
    }
    const {
      httpAuthOption: { signingProperties },
      identity,
      signer,
    } = scheme;
    return next({
      ...args,
      request: await signer.sign(args.request, identity, signingProperties || {}),
    });
  };
