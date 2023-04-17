import { HttpHandlerOptions, RequestHandler } from "@smithy-io/types";

import { HttpRequest } from "./httpRequest";
import { HttpResponse } from "./httpResponse";

export type HttpHandler = RequestHandler<HttpRequest, HttpResponse, HttpHandlerOptions>;
