/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import type { HeaderBag, HttpMessage, HttpResponse as IHttpResponse } from "@smithy/types";

type HttpResponseOptions = Partial<HttpMessage> & {
  statusCode: number;
  reason?: string;
};

/**
 * Use the distinct IHttpResponse interface from \@smithy/types instead.
 * This should not be used due to
 * overlapping with the concrete class' name.
 *
 * This is not marked deprecated since that would mark the concrete class
 * deprecated as well.
 *
 * @internal
 */
export interface HttpResponse extends IHttpResponse {}

/**
 * @public
 */
export class HttpResponse {
  public statusCode: number;
  public reason?: string;
  public headers: HeaderBag;
  public body?: any;

  constructor(options: HttpResponseOptions) {
    this.statusCode = options.statusCode;
    this.reason = options.reason;
    this.headers = options.headers || {};
    this.body = options.body;
  }

  static isInstance(response: unknown): response is HttpResponse {
    //determine if response is a valid HttpResponse
    if (!response) return false;
    const resp = response as any;
    return typeof resp.statusCode === "number" && typeof resp.headers === "object";
  }
}
