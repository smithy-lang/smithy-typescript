import { HttpHandler, HttpRequest, HttpResponse } from "@smithy/protocol-http";
import { buildQueryString } from "@smithy/querystring-builder";
import { ConnectConfiguration, HttpHandlerOptions, Provider, RequestContext } from "@smithy/types";
import { ClientHttp2Session, constants } from "http2";

import { getTransformedHeaders } from "./get-transformed-headers";
import { NodeHttp2ConnectionManager } from "./node-http2-connection-manager";
import { writeRequestBody } from "./write-request-body";

/**
 * Represents the http2 options that can be passed to a node http2 client.
 * @public
 */
export interface NodeHttp2HandlerOptions {
  /**
   * The maximum time in milliseconds that a stream may remain idle before it
   * is closed.
   */
  requestTimeout?: number;

  /**
   * The maximum time in milliseconds that a session or socket may remain idle
   * before it is closed.
   * https://nodejs.org/docs/latest-v12.x/api/http2.html#http2_http2session_and_sockets
   */
  sessionTimeout?: number;

  /**
   * Disables processing concurrent streams on a ClientHttp2Session instance. When set
   * to true, a new session instance is created for each request to a URL.
   * **Default:** false.
   * https://nodejs.org/api/http2.html#http2_class_clienthttp2session
   */
  disableConcurrentStreams?: boolean;

  /**
   * Maximum number of concurrent Http2Stream instances per ClientHttp2Session. Each session
   * may have up to 2^31-1 Http2Stream instances over its lifetime.
   * This value must be greater than or equal to 0.
   * https://nodejs.org/api/http2.html#class-http2stream
   */
  maxConcurrentStreams?: number;
}

/**
 * A request handler using the node:http2 package.
 * @public
 */
export class NodeHttp2Handler implements HttpHandler<NodeHttp2HandlerOptions> {
  private config?: NodeHttp2HandlerOptions;
  private configProvider: Promise<NodeHttp2HandlerOptions>;

  public readonly metadata = { handlerProtocol: "h2" };

  private readonly connectionManager: NodeHttp2ConnectionManager = new NodeHttp2ConnectionManager({});

  /**
   * @returns the input if it is an HttpHandler of any class,
   * or instantiates a new instance of this handler.
   */
  public static create(
    instanceOrOptions?: HttpHandler<any> | NodeHttp2HandlerOptions | Provider<NodeHttp2HandlerOptions | void>
  ) {
    if (typeof (instanceOrOptions as any)?.handle === "function") {
      // is already an instance of HttpHandler.
      return instanceOrOptions as HttpHandler<any>;
    }
    // input is ctor options or undefined.
    return new NodeHttp2Handler(instanceOrOptions as NodeHttp2HandlerOptions);
  }

  constructor(options?: NodeHttp2HandlerOptions | Provider<NodeHttp2HandlerOptions | void>) {
    this.configProvider = new Promise((resolve, reject) => {
      if (typeof options === "function") {
        options()
          .then((opts) => {
            resolve(opts || {});
          })
          .catch(reject);
      } else {
        resolve(options || {});
      }
    });
  }

  destroy(): void {
    this.connectionManager.destroy();
  }

  async handle(
    request: HttpRequest,
    { abortSignal, requestTimeout }: HttpHandlerOptions = {}
  ): Promise<{ response: HttpResponse }> {
    if (!this.config) {
      this.config = await this.configProvider;
      this.connectionManager.setDisableConcurrentStreams(this.config.disableConcurrentStreams || false);
      if (this.config.maxConcurrentStreams) {
        this.connectionManager.setMaxConcurrentStreams(this.config.maxConcurrentStreams);
      }
    }
    const { requestTimeout: configRequestTimeout, disableConcurrentStreams } = this.config;
    const effectiveRequestTimeout = requestTimeout ?? configRequestTimeout;
    return new Promise((_resolve, _reject) => {
      // It's redundant to track fulfilled because promises use the first resolution/rejection
      // but avoids generating unnecessary stack traces in the "close" event handler.
      let fulfilled = false;

      let writeRequestBodyPromise: Promise<void> | undefined = undefined;
      const resolve = async (arg: { response: HttpResponse }) => {
        await writeRequestBodyPromise;
        _resolve(arg);
      };
      const reject = async (arg: unknown) => {
        await writeRequestBodyPromise;
        _reject(arg);
      };

      // if the request was already aborted, prevent doing extra work
      if (abortSignal?.aborted) {
        fulfilled = true;
        const abortError = new Error("Request aborted");
        abortError.name = "AbortError";
        reject(abortError);
        return;
      }

      const { hostname, method, port, protocol, query } = request;
      let auth = "";
      if (request.username != null || request.password != null) {
        const username = request.username ?? "";
        const password = request.password ?? "";
        auth = `${username}:${password}@`;
      }
      const authority = `${protocol}//${auth}${hostname}${port ? `:${port}` : ""}`;
      const requestContext = { destination: new URL(authority) } as RequestContext;
      const session = this.connectionManager.lease(requestContext, {
        requestTimeout: this.config?.sessionTimeout,
        disableConcurrentStreams: disableConcurrentStreams || false,
      } as ConnectConfiguration);

      const rejectWithDestroy = (err: Error) => {
        if (disableConcurrentStreams) {
          this.destroySession(session);
        }
        fulfilled = true;
        reject(err);
      };

      const queryString = buildQueryString(query || {});
      let path = request.path;
      if (queryString) {
        path += `?${queryString}`;
      }
      if (request.fragment) {
        path += `#${request.fragment}`;
      }
      // create the http2 request
      const req = session.request({
        ...request.headers,
        [constants.HTTP2_HEADER_PATH]: path,
        [constants.HTTP2_HEADER_METHOD]: method,
      });

      // Keep node alive while request is in progress. Matched with unref() in close event.
      session.ref();

      req.on("response", (headers) => {
        const httpResponse = new HttpResponse({
          statusCode: headers[":status"] || -1,
          headers: getTransformedHeaders(headers),
          body: req,
        });
        fulfilled = true;
        resolve({ response: httpResponse });
        if (disableConcurrentStreams) {
          // Gracefully closes the Http2Session, allowing any existing streams to complete
          // on their own and preventing new Http2Stream instances from being created.
          session.close();
          this.connectionManager.deleteSession(authority, session);
        }
      });

      if (effectiveRequestTimeout) {
        req.setTimeout(effectiveRequestTimeout, () => {
          req.close();
          const timeoutError = new Error(`Stream timed out because of no activity for ${effectiveRequestTimeout} ms`);
          timeoutError.name = "TimeoutError";
          rejectWithDestroy(timeoutError);
        });
      }

      if (abortSignal) {
        const onAbort = () => {
          req.close();
          const abortError = new Error("Request aborted");
          abortError.name = "AbortError";
          rejectWithDestroy(abortError);
        };
        if (typeof (abortSignal as AbortSignal).addEventListener === "function") {
          // preferred.
          const signal = abortSignal as AbortSignal;
          signal.addEventListener("abort", onAbort, { once: true });
          req.once("close", () => signal.removeEventListener("abort", onAbort));
        } else {
          // backwards compatibility
          abortSignal.onabort = onAbort;
        }
      }

      // Set up handlers for errors
      req.on("frameError", (type: number, code: number, id: number) => {
        rejectWithDestroy(new Error(`Frame type id ${type} in stream id ${id} has failed with code ${code}.`));
      });
      req.on("error", rejectWithDestroy);
      req.on("aborted", () => {
        rejectWithDestroy(
          new Error(`HTTP/2 stream is abnormally aborted in mid-communication with result code ${req.rstCode}.`)
        );
      });

      // The HTTP/2 error code used when closing the stream can be retrieved using the
      // http2stream.rstCode property. If the code is any value other than NGHTTP2_NO_ERROR (0),
      // an 'error' event will have also been emitted.
      req.on("close", () => {
        session.unref();
        if (disableConcurrentStreams) {
          session.destroy();
        }
        if (!fulfilled) {
          rejectWithDestroy(new Error("Unexpected error: http2 request did not get a response"));
        }
      });

      writeRequestBodyPromise = writeRequestBody(req, request, effectiveRequestTimeout);
    });
  }

  updateHttpClientConfig(key: keyof NodeHttp2HandlerOptions, value: NodeHttp2HandlerOptions[typeof key]): void {
    this.config = undefined;
    this.configProvider = this.configProvider.then((config) => {
      return {
        ...config,
        [key]: value,
      };
    });
  }

  httpHandlerConfigs(): NodeHttp2HandlerOptions {
    return this.config ?? {};
  }

  /**
   * Destroys a session.
   * @param session - the session to destroy.
   */
  private destroySession(session: ClientHttp2Session): void {
    if (!session.destroyed) {
      session.destroy();
    }
  }
}
