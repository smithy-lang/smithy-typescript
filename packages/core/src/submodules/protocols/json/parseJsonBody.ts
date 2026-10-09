import type { HttpResponse, Schema, SerdeFunctions } from "@smithy/types";
import { collectBody } from "../collect-stream-body";
import { collectBodyString } from "../common";
import { detectBufferParsing } from "./detectBufferParsing";
import { jsonReviver } from "./jsonReviver";
import { needsReviver } from "./needsReviver";

/**
 * @deprecated new calls to parseJsonBody must pass schema.
 * @internal
 */
export async function parseJsonBody(streamBody: any, context: SerdeFunctions): Promise<any>;
/**
 * @internal
 */
export async function parseJsonBody(streamBody: any, context: SerdeFunctions, schema: Schema): Promise<any>;
/**
 * @internal
 */
export async function parseJsonBody(streamBody: any, context: SerdeFunctions, schema?: Schema): Promise<any> {
  // Fast path: if streamBody is an async iterable and JSON.parse(Buffer) is supported,
  // collect chunks directly and parse the concatenated Buffer without UTF-8 decode.
  let parsingInput: any;

  if (detectBufferParsing() && typeof streamBody?.[Symbol.asyncIterator] === "function") {
    const buffer = await collectBody(streamBody, context);
    if (typeof Buffer === "function") {
      if (Buffer.isBuffer(buffer)) {
        parsingInput = buffer;
      } else {
        parsingInput = Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      }
    }
  }
  if (!parsingInput) {
    // Fallback: collect to string
    parsingInput = await collectBodyString(streamBody, context);
  }
  if (parsingInput.length === 0) {
    return {};
  }

  /**
   * We require a schema to use the reviver, because in the pre-schema implementation
   * of this function, no reviver was used to parse JSON.
   */
  const reviver = schema && needsReviver(schema) ? jsonReviver : undefined;

  try {
    return JSON.parse(parsingInput, reviver);
  } catch (e: any) {
    if (e?.name === "SyntaxError") {
      Object.defineProperty(e, "$responseBodyText", {
        value: typeof parsingInput === "string" ? parsingInput : parsingInput.toString("utf8"),
      });
    }
    throw e;
  }
}

/**
 * @internal
 */
export const parseJsonErrorBody = async (errorBody: any, context: SerdeFunctions) => {
  const value = await parseJsonBody(errorBody, context);
  value.message = value.message ?? value.Message;
  return value;
};

/**
 * @internal
 */
const findKey = (object: any, key: string) => Object.keys(object).find((k) => k.toLowerCase() === key.toLowerCase());

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
export const loadRestJsonErrorCode = (output: HttpResponse, data: any): string | undefined => {
  return loadErrorCode(output, data, ["header", "code", "type"]);
};

/**
 * @internal
 */
export const loadJsonRpcErrorCode = (output: HttpResponse, data: any, queryCompat = false): string | undefined => {
  return loadErrorCode(output, data, queryCompat ? ["code", "header", "type"] : ["type", "code", "header"]);
};

/**
 * Smithy RPCv2 JSON error identifier loader.
 *
 * Unlike {@link loadJsonRpcErrorCode} (used by AWS JSON 1.0/1.1 and restJson1),
 * this preserves the ABSOLUTE shape id carried in `__type`. The RPCv2 JSON SEP
 * requires `__type` to contain the fully-qualified shape id, and the protocol
 * resolves errors by that absolute id to avoid ambiguous resolution when the
 * same shape name exists in more than one namespace.
 *
 * It trims the Smithy-specific `,` fault/tag suffix and the `:` suffix, but does
 * NOT strip the `#` namespace separator:
 *   "com.a.b#Error:Sender,tag" -> "com.a.b#Error"
 *
 * @internal
 */
export const loadSmithyRpcV2JsonErrorCode = (output: HttpResponse, data: any): string | undefined => {
  if (data?.__type !== undefined) {
    let cleanValue: string | number = data.__type;
    if (typeof cleanValue === "number") {
      cleanValue = cleanValue.toString();
    }
    if (cleanValue.indexOf(",") >= 0) {
      cleanValue = cleanValue.split(",")[0];
    }
    if (cleanValue.indexOf(":") >= 0) {
      cleanValue = cleanValue.split(":")[0];
    }
    return cleanValue;
  }
};

/**
 * @internal
 */
const loadErrorCode = (
  { headers }: HttpResponse,
  data: any,
  order: ("header" | "code" | "type")[]
): string | undefined => {
  while (order.length > 0) {
    const location = order.shift();
    switch (location) {
      case "header":
        const headerKey = findKey(headers ?? {}, "x-amzn-errortype");
        if (headerKey !== undefined) {
          return sanitizeErrorCode(headers[headerKey]);
        }
        break;
      case "code":
        const codeKey = findKey(data ?? {}, "code");
        if (codeKey && data[codeKey] !== undefined) {
          return sanitizeErrorCode(data[codeKey]);
        }
        break;
      case "type":
        if (data?.__type !== undefined) {
          return sanitizeErrorCode(data.__type);
        }
        break;
    }
  }
};
