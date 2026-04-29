import type { HttpRequest } from "@smithy/core/protocols";

/**
 * @internal
 */
export const isStreamingPayload = (request: HttpRequest): boolean => request?.body instanceof ReadableStream;
