import { constants } from "node:http2";
import { HttpResponse, buildQueryString, type HttpHandler, type HttpRequest } from "@smithy/core/protocols";
import type { HttpHandlerOptions, Provider, RequestContext } from "@smithy/types";

import { buildAbortError } from "./build-abort-error";
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
 * This is derived from the smithyContext object. This signals to the NodeHttp2Handler specifically
 * that the connection pool should not be used to acquire a connection. The event stream should
 * have its own new connection.
 *
 * This does not apply to WebSocket event streams, since there is no pooling.
 *
 * @internal
 */
type EventStreamSignal = {
  isEventStream?: boolean;
};

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

  public destroy(): void {
    this.connectionManager.destroy();
  }

  public async handle(
    request: HttpRequest,
    { abortSignal, requestTimeout, isEventStream }: HttpHandlerOptions & EventStreamSignal = {}
  ): Promise<{ response: HttpResponse }> {
    if (!this.config) {
      this.config = await this.configProvider;
      const { disableConcurrentStreams, maxConcurrentStreams } = this.config;

      this.connectionManager.setDisableConcurrentStreams(disableConcurrentStreams ?? false);
      if (maxConcurrentStreams) {
        this.connectionManager.setMaxConcurrentStreams(maxConcurrentStreams);
      }
    }

    const { requestTimeout: configRequestTimeout, disableConcurrentStreams } = this.config;
    const useIsolatedSession = disableConcurrentStreams || isEventStream;
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
        const abortError = buildAbortError(abortSignal);
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

      const connectConfig = {
        requestTimeout: this.config?.sessionTimeout,
        isEventStream,
      };
      const ref = useIsolatedSession
        ? this.connectionManager.createIsolatedSession(requestContext, connectConfig)
        : this.connectionManager.lease(requestContext, connectConfig);

      const session = ref.deref();

      const rejectWithDestroy = (err: Error) => {
        if (useIsolatedSession) {
          ref.destroy();
        }
        fulfilled = true;
        reject(err);
      };

      const queryString = query ? buildQueryString(query) : "";
      let path = request.path;
      if (queryString) {
        path += `?${queryString}`;
      }
      if (request.fragment) {
        path += `#${request.fragment}`;
      }
      // create the http2 request
      const clientHttp2Stream = session.request({
        ...request.headers,
        [constants.HTTP2_HEADER_PATH]: path,
        [constants.HTTP2_HEADER_METHOD]: method,
      });

      if (effectiveRequestTimeout) {
        clientHttp2Stream.setTimeout(effectiveRequestTimeout, () => {
          clientHttp2Stream.close();
          const timeoutError = new Error(`Stream timed out because of no activity for ${effectiveRequestTimeout} ms`);
          timeoutError.name = "TimeoutError";
          rejectWithDestroy(timeoutError);
        });
      }

      if (abortSignal) {
        const onAbort = () => {
          clientHttp2Stream.close();
          const abortError = buildAbortError(abortSignal);
          rejectWithDestroy(abortError);
        };
        if (typeof (abortSignal as AbortSignal).addEventListener === "function") {
          // preferred.
          const signal = abortSignal as AbortSignal;
          signal.addEventListener("abort", onAbort, { once: true });
          clientHttp2Stream.once("close", () => signal.removeEventListener("abort", onAbort));
        } else {
          // backwards compatibility
          abortSignal.onabort = onAbort;
        }
      }

      // Set up handlers for errors
      clientHttp2Stream.on("frameError", (type: number, code: number, id: number) => {
        rejectWithDestroy(new Error(`Frame type id ${type} in stream id ${id} has failed with code ${code}.`));
      });
      clientHttp2Stream.on("error", rejectWithDestroy);
      clientHttp2Stream.on("aborted", () => {
        rejectWithDestroy(
          new Error(
            `HTTP/2 stream is abnormally aborted in mid-communication with result code ${clientHttp2Stream.rstCode}.`
          )
        );
      });

      clientHttp2Stream.on("response", (headers) => {
        const httpResponse = new HttpResponse({
          statusCode: headers[":status"] ?? -1,
          headers: getTransformedHeaders(headers),
          body: clientHttp2Stream,
        });
        fulfilled = true;
        resolve({ response: httpResponse });

        if (useIsolatedSession) {
          // Gracefully closes the Http2Session, allowing any existing streams to complete
          // on their own and preventing new Http2Stream instances from being created.
          session.close();
        }
      });

      // The HTTP/2 error code used when closing the stream can be retrieved using the
      // http2stream.rstCode property. If the code is any value other than NGHTTP2_NO_ERROR (0),
      // an 'error' event will have also been emitted.
      clientHttp2Stream.on("close", () => {
        if (useIsolatedSession) {
          ref.destroy();
        } else {
          this.connectionManager.release(requestContext, ref);
        }
        if (!fulfilled) {
          rejectWithDestroy(new Error("Unexpected error: http2 request did not get a response"));
        }
      });

      writeRequestBodyPromise = writeRequestBody(clientHttp2Stream, request, effectiveRequestTimeout);
    });
  }

  public updateHttpClientConfig(key: keyof NodeHttp2HandlerOptions, value: NodeHttp2HandlerOptions[typeof key]): void {
    this.config = undefined;
    this.configProvider = this.configProvider.then((config) => {
      return {
        ...config,
        [key]: value,
      };
    });
  }

  public httpHandlerConfigs(): NodeHttp2HandlerOptions {
    return this.config ?? {};
  }
}
