import { HandlerExecutionContext, SMITHY_CONTEXT_KEY } from "@smithy/types";

/**
 * @internal
 */
export const getSmithyContext = (context: HandlerExecutionContext): Record<string, unknown> =>
  context[SMITHY_CONTEXT_KEY] || (context[SMITHY_CONTEXT_KEY] = {});
