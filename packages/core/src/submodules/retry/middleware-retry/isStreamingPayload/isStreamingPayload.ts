import { Readable } from "node:stream";
import type { HttpRequest } from "@smithy/core/protocols";

/**
 * @internal
 */
export const isStreamingPayload = (request: HttpRequest): boolean =>
  request?.body instanceof Readable ||
  (typeof ReadableStream !== "undefined" && request?.body instanceof ReadableStream);
