import { HttpRequest } from "@smithy/protocol-http";
import {
  FinalizeHandler,
  FinalizeHandlerArguments,
  FinalizeHandlerOutput,
  MetadataBearer,
  Pluggable,
  RelativeMiddlewareOptions,
} from "@smithy/types";
import { INVOCATION_ID_HEADER, REQUEST_HEADER } from "@smithy/util-retry";

/**
 * @internal
 */
export const omitRetryHeadersMiddleware =
  () =>
  <Output extends MetadataBearer = MetadataBearer>(next: FinalizeHandler<any, Output>): FinalizeHandler<any, Output> =>
  async (args: FinalizeHandlerArguments<any>): Promise<FinalizeHandlerOutput<Output>> => {
    const { request } = args;
    if (HttpRequest.isInstance(request)) {
      delete request.headers[INVOCATION_ID_HEADER];
      delete request.headers[REQUEST_HEADER];
    }
    return next(args);
  };

/**
 * @internal
 */
export const omitRetryHeadersMiddlewareOptions: RelativeMiddlewareOptions = {
  name: "omitRetryHeadersMiddleware",
  tags: ["RETRY", "HEADERS", "OMIT_RETRY_HEADERS"],
  relation: "before",
  toMiddleware: "awsAuthMiddleware",
  override: true,
};

/**
 * @internal
 */
export const getOmitRetryHeadersPlugin = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  options: unknown
): Pluggable<any, any> => ({
  applyToStack: (clientStack) => {
    clientStack.addRelativeTo(omitRetryHeadersMiddleware(), omitRetryHeadersMiddlewareOptions);
  },
});
