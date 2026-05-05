import type {
  HttpResponse,
  HttpRequest as IHttpRequest,
  HttpResponse as IHttpResponse,
  StaticOperationSchema,
} from "@smithy/types";

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

/**
 * Server protocol for snapshot testing.
 *
 * @internal
 */
export interface SnapshotServerProtocol {
  getShapeId(): string;

  serializeResponse<Output extends object>(
    operationSchema: StaticOperationSchema,
    output: Output
  ): Promise<HttpResponse>;
}
