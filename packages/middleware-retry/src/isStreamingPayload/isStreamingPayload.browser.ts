import type { HttpRequest } from "@smithy/protocol-http";

/**
 * @internal
 */
export const isStreamingPayload = (request: HttpRequest): boolean => {
  return request?.body instanceof ReadableStream;
};
