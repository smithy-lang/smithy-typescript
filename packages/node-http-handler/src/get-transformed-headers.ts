import type { IncomingHttpHeaders } from "node:http2";
import type { HeaderBag } from "@smithy/types";

const getTransformedHeaders = (headers: IncomingHttpHeaders) => {
  const transformedHeaders: HeaderBag = {};

  for (const name in headers) {
    const headerValues = <string>headers[name];
    transformedHeaders[name] = Array.isArray(headerValues) ? headerValues.join(",") : headerValues;
  }

  return transformedHeaders;
};

export { getTransformedHeaders };
