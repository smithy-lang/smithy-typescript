import { HttpRequest } from "@smithy/protocol-http";
import type { HttpRequest as IHttpRequest, QueryParameterBag } from "@smithy/types";

/**
 * @internal
 */
export const moveHeadersToQuery = (
  request: IHttpRequest,
  options: { unhoistableHeaders?: Set<string>; hoistableHeaders?: Set<string> } = {}
): IHttpRequest & { query: QueryParameterBag } => {
  const { headers, query = {} as QueryParameterBag } = HttpRequest.clone(request);
  for (const name of Object.keys(headers)) {
    const lname = name.toLowerCase();
    if (
      (lname.slice(0, 6) === "x-amz-" && !options.unhoistableHeaders?.has(lname)) ||
      options.hoistableHeaders?.has(lname)
    ) {
      query[name] = headers[name];
      delete headers[name];
    }
  }

  return {
    ...request,
    headers,
    query,
  };
};
