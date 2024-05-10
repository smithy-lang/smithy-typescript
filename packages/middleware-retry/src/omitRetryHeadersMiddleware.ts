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

export const omitRetryHeadersMiddlewareOptions: RelativeMiddlewareOptions = {
  name: "omitRetryHeadersMiddleware",
  tags: ["RETRY", "HEADERS", "OMIT_RETRY_HEADERS"],
  relation: "before",
  toMiddleware: "awsAuthMiddleware",
  override: true,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getOmitRetryHeadersPlugin = (options: unknown): Pluggable<any, any> => ({
  applyToStack: (clientStack) => {
    clientStack.addRelativeTo(omitRetryHeadersMiddleware(), omitRetryHeadersMiddlewareOptions);
  },
});
