import { HandlerExecutionContext } from "@smithy/types";

import { HttpAuthOption } from "./HttpAuthScheme";

/**
 * @internal
 */
export interface HttpAuthSchemeParameters {
  operation?: string;
}

/**
 * @internal
 */
export interface HttpAuthSchemeProvider<TParameters extends HttpAuthSchemeParameters = HttpAuthSchemeParameters> {
  (authParameters: TParameters): HttpAuthOption[];
}

/**
 * @internal
 */
export interface HttpAuthSchemeParametersProvider<
  C extends object = object,
  T extends HttpAuthSchemeParameters = HttpAuthSchemeParameters
> {
  (config: C, context: HandlerExecutionContext, input: Record<string, unknown>): Promise<T>;
}
