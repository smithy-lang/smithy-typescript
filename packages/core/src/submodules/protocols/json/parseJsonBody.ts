import type { HttpResponse as IHttpResponse, SerdeFunctions } from "@smithy/types";
import { toUtf8 } from "@smithy/util-utf8";

import { collectBody } from "../collect-stream-body";

/**
 * @internal
 */
export const collectBodyString = (streamBody: any, context: SerdeFunctions): Promise<string> =>
  collectBody(streamBody, context).then((body) => (context?.utf8Encoder ?? toUtf8)(body));

/**
 * @internal
 */
export const parseJsonBody = (streamBody: any, context: SerdeFunctions): any =>
  collectBodyString(streamBody, context).then((encoded) => {
    if (encoded.length) {
      try {
        return JSON.parse(encoded);
      } catch (e: any) {
        if (e?.name === "SyntaxError") {
          Object.defineProperty(e, "$responseBodyText", {
            value: encoded,
          });
        }
        throw e;
      }
    }
    return {};
  });

/**
 * @internal
 */
const sanitizeErrorCode = (rawValue: string | number): string => {
  let cleanValue = rawValue;
  if (typeof cleanValue === "number") {
    cleanValue = cleanValue.toString();
  }
  if (cleanValue.indexOf(",") >= 0) {
    cleanValue = cleanValue.split(",")[0];
  }
  if (cleanValue.indexOf(":") >= 0) {
    cleanValue = cleanValue.split(":")[0];
  }
  if (cleanValue.indexOf("#") >= 0) {
    cleanValue = cleanValue.split("#")[1];
  }
  return cleanValue;
};

/**
 * @internal
 */
export const loadSmithyRpcV2JsonErrorCode = (output: IHttpResponse, data: any): string | undefined => {
  if (data["__type"] !== undefined) {
    return sanitizeErrorCode(data["__type"]);
  }
};

/**
 * @internal
 *
 * Loads the error code from a REST-JSON error response.
 * Checks the body for a case-insensitive "code" or "__type" field,
 * and the "x-amzn-errortype" response header.
 */
export const loadRestJsonErrorCode = (output: IHttpResponse, data: any): string | undefined => {
  const findKey = (object: any, key: string): string | undefined =>
    Object.keys(object).find((k) => k.toLowerCase() === key.toLowerCase());

  const sanitizedCode = data[findKey(data, "code") ?? "code"];
  if (sanitizedCode !== undefined) {
    return sanitizeErrorCode(sanitizedCode);
  }

  const headerKey = findKey(output.headers, "x-amzn-errortype");
  if (headerKey !== undefined) {
    return sanitizeErrorCode(output.headers[headerKey]);
  }

  if (data["__type"] !== undefined) {
    return sanitizeErrorCode(data["__type"]);
  }
};
