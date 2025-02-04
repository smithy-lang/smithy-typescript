import { HttpRequest, HttpResponse } from "@smithy/protocol-http";
import { HandlerExecutionContext, Transport } from "@smithy/types";

export class HttpTransport implements Transport<HttpRequest, HttpResponse> {
  getRequestType(): new (...args: any[]) => HttpRequest {
    return HttpRequest;
  }
  getResponseType(): new (...args: any[]) => HttpResponse {
    return HttpResponse;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  send(context: HandlerExecutionContext, request: HttpRequest): Promise<HttpResponse> {
    throw new Error("Method not implemented.");
  }
}
