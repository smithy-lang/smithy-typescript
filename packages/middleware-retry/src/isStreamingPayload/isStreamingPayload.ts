import type { HttpRequest } from "@smithy/protocol-http";
import { Readable } from "stream";

/**
 * @internal
 */
export const isStreamingPayload = (request: HttpRequest): boolean =>
  request?.body instanceof Readable ||
  (typeof ReadableStream !== "undefined" && request?.body instanceof ReadableStream);
