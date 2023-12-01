import type { HttpRequest } from "@smithy/protocol-http";

/**
 * @internal
 */
export const isStreamingPayload = (request: HttpRequest): boolean => request?.body instanceof ReadableStream;
