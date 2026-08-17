import { hasOwn } from "@smithy/core/serde";
import { HttpRequest } from "@smithy/core/protocols";
import type { HttpRequest as IHttpRequest } from "@smithy/types";

import { GENERATED_HEADERS } from "./constants";

/**
 * @internal
 */
export const prepareRequest = (request: IHttpRequest): IHttpRequest => {
  // Create a clone of the request object that does not clone the body
  request = HttpRequest.clone(request);

  for (const headerName in request.headers) {
    if (!hasOwn(request.headers, headerName)) continue;
    if (GENERATED_HEADERS.indexOf(headerName.toLowerCase()) > -1) {
      delete request.headers[headerName];
    }
  }

  return request;
};
