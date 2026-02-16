import type { HttpRequest as IHttpRequest, HttpResponse as IHttpResponse } from "@smithy/types";

/**
 * @internal
 */
export type PayloadWithHeaders = Pick<IHttpRequest, "body" | "headers"> | Pick<IHttpResponse, "body" | "headers">;

/**
 * @internal
 */
export class RequestSnapshotCompleted extends Error {
  public snapshotComplete = true;
}
