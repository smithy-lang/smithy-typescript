import { collectBody } from "@smithy/smithy-client";
import type { HttpResponse, SerdeContext } from "@smithy/types";

import { cbor } from "./cbor";

/**
 * @internal
 */
export const parseCborBody = (streamBody: any, context: SerdeContext): any => {
  return collectBody(streamBody, context).then(async (bytes) => {
    if (bytes.length) {
      try {
        return cbor.deserialize(bytes);
      } catch (e: any) {
        Object.defineProperty(e, "$responseBodyText", {
          value: context.utf8Encoder(bytes),
        });
        throw e;
      }
    }
    return {};
  });
};

/**
 * @internal
 */
export const dateToTag = (date: Date): { tag: 1; value: number } => {
  return {
    tag: 1,
    value: date.getTime() / 1000,
  };
};

/**
 * @internal
 */
export const parseCborErrorBody = async (errorBody: any, context: SerdeContext) => {
  const value = await parseCborBody(errorBody, context);
  value.message = value.message ?? value.Message;
  return value;
};

/**
 * @internal
 */
export const loadSmithyRpcV2CborErrorCode = (output: HttpResponse, data: any): string | undefined => {
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

  if (data["__type"] !== undefined) {
    return sanitizeErrorCode(data["__type"]);
  }

  if (data.code !== undefined) {
    return sanitizeErrorCode(data.code);
  }
};

export const checkCborResponse = (response: HttpResponse): void => {
  if (response.headers["smithy-protocol"] !== "rpc-v2-cbor") {
    throw new Error("Malformed RPCv2 CBOR response, status: " + response.statusCode);
  }
};
