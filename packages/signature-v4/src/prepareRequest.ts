import { HttpRequest } from "@smithy/protocol-http";
import type { HttpRequest as IHttpRequest } from "@smithy/types";

import { GENERATED_HEADERS } from "./constants";

/**
 * @private
 */
export const prepareRequest = (request: IHttpRequest): IHttpRequest => {
  // Create a clone of the request object that does not clone the body
  request = HttpRequest.clone(request);

  for (const headerName of Object.keys(request.headers)) {
    if (GENERATED_HEADERS.indexOf(headerName.toLowerCase()) > -1) {
      delete request.headers[headerName];
    }
  }

  return request;
};
