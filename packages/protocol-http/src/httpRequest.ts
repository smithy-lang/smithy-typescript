/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { HeaderBag, HttpMessage, HttpRequest as IHttpRequest, QueryParameterBag, URI } from "@smithy/types";

type HttpRequestOptions = Partial<HttpMessage> & Partial<URI> & { method?: string };

/**
 * Use the distinct IHttpRequest interface from @smithy/types instead.
 * This should not be used due to
 * overlapping with the concrete class' name.
 *
 * This is not marked deprecated since that would mark the concrete class
 * deprecated as well.
 */
export interface HttpRequest extends IHttpRequest {}

/**
 * @public
 */
export { IHttpRequest };

/**
 * @public
 */
export class HttpRequest implements HttpMessage, URI {
  public method: string;
  public protocol: string;
  public hostname: string;
  public port?: number;
  public path: string;
  public query: QueryParameterBag;
  public headers: HeaderBag;
  public username?: string;
  public password?: string;
  public fragment?: string;
  public body?: any;

  public constructor(options: HttpRequestOptions) {
    this.method = options.method || "GET";
    this.hostname = options.hostname || "localhost";
    this.port = options.port;
    this.query = options.query || {};
    this.headers = options.headers || {};
    this.body = options.body;
    this.protocol = options.protocol
      ? options.protocol.slice(-1) !== ":"
        ? `${options.protocol}:`
        : options.protocol
      : "https:";
    this.path = options.path ? (options.path.charAt(0) !== "/" ? `/${options.path}` : options.path) : "/";
    this.username = options.username;
    this.password = options.password;
    this.fragment = options.fragment;
  }

  /**
   * Note: this does not deep-clone the body.
   */
  public static clone(request: IHttpRequest) {
    const cloned = new HttpRequest({
      ...request,
      headers: { ...request.headers },
    });
    if (cloned.query) {
      cloned.query = cloneQuery(cloned.query);
    }
    return cloned;
  }

  /**
   * This method only actually asserts that request is the interface {@link IHttpRequest},
   * and not necessarily this concrete class. Left in place for API stability.
   *
   * Do not call instance methods on the input of this function, and
   * do not assume it has the HttpRequest prototype.
   */
  public static isInstance(request: unknown): request is HttpRequest {
    if (!request) {
      return false;
    }
    const req: any = request;
    return (
      "method" in req &&
      "protocol" in req &&
      "hostname" in req &&
      "path" in req &&
      typeof req["query"] === "object" &&
      typeof req["headers"] === "object"
    );
  }

  /**
   * @deprecated use static HttpRequest.clone(request) instead. It's not safe to call
   * this method because {@link HttpRequest.isInstance} incorrectly
   * asserts that IHttpRequest (interface) objects are of type HttpRequest (class).
   */
  public clone(): HttpRequest {
    return HttpRequest.clone(this);
  }
}

function cloneQuery(query: QueryParameterBag): QueryParameterBag {
  return Object.keys(query).reduce((carry: QueryParameterBag, paramName: string) => {
    const param = query[paramName];
    return {
      ...carry,
      [paramName]: Array.isArray(param) ? [...param] : param,
    };
  }, {});
}
