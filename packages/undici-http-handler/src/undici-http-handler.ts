import type { Readable } from "node:stream";
import { HttpResponse, buildQueryString, type HttpHandler, type HttpRequest } from "@smithy/core/protocols";
import type { HttpHandlerOptions, Logger } from "@smithy/types";
import { Agent, Client, Dispatcher } from "undici";

/**
 * Duck-type check: returns true if the value looks like a Dispatcher
 * (has `request`, `close`, and `destroy` methods), as opposed to plain
 * Agent.Options. We require all three because the handler invokes each
 * of them — checking only `request` would let a partial mock through
 * and surface as a TypeError later when `close`/`destroy` is called.
 */
const isDispatcher = (value: unknown): value is Dispatcher => {
  if (value instanceof Dispatcher) {
    return true;
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.request === "function" &&
    typeof candidate.close === "function" &&
    typeof candidate.destroy === "function"
  );
};

/**
 * Options for the UndiciHttpHandler.
 *
 * @public
 */
export interface UndiciHttpHandlerOptions {
  /**
   * You can pass an existing undici Dispatcher (Agent, Pool, Client, etc.)
   * or Agent.Options to have one created for you.
   *
   * Passing your own Dispatcher lets you control the undici version at
   * runtime, independent of this package's bundled version. This lets
   * you pick up upstream performance improvements sooner.
   */
  dispatcher?: Dispatcher | Agent.Options;

  /**
   * Optional logger.
   */
  logger?: Logger;
}

/**
 * This is derived from the smithyContext object. This signals to the UndiciHttpHandler
 * that the shared connection pool should not be used. The event stream should
 * have its own dedicated connection.
 *
 * This does not apply to WebSocket event streams, since there is no pooling.
 *
 * @internal
 */
type EventStreamSignal = {
  isEventStream?: boolean;
};

/**
 * An HTTP handler that uses undici instead of Node.js native http/https modules.
 * Smithy-compatible request handler backed by undici.
 *
 * @public
 */
export class UndiciHttpHandler implements HttpHandler<UndiciHttpHandlerOptions> {
  private config: { dispatcher?: Dispatcher; logger?: Logger };

  constructor(options?: UndiciHttpHandlerOptions) {
    if (options?.dispatcher && isDispatcher(options.dispatcher)) {
      this.config = { ...options, dispatcher: options.dispatcher };
    } else if (options?.dispatcher) {
      // Caller passed Agent.Options — create an Agent for them.
      this.config = { ...options, dispatcher: new Agent({ allowH2: true, ...options.dispatcher }) };
    } else {
      this.config = { ...options } as { dispatcher?: Dispatcher; logger?: Logger };
    }
  }

  public destroy(): void {
    this.config.dispatcher?.destroy();
    this.config.dispatcher = undefined;
  }

  public async handle(
    request: HttpRequest,
    { abortSignal, requestTimeout, isEventStream }: HttpHandlerOptions & EventStreamSignal = {}
  ): Promise<{ response: HttpResponse }> {
    // Use an isolated client for event streams to avoid sharing the
    // connection pool with regular requests.
    const isolatedClient = isEventStream ? this.createIsolatedClient(request) : undefined;
    const dispatcher = isolatedClient ?? this.getOrCreateDispatcher();

    if (abortSignal?.aborted) {
      if (isolatedClient) {
        isolatedClient.destroy();
      }
      throw Object.assign(new Error("Request aborted"), {
        name: "AbortError",
      });
    }

    // Build path with query string — skip buildQueryString when query is undefined.
    let path = request.path;
    if (request.query) {
      const queryString = buildQueryString(request.query);
      if (queryString) {
        path += `?${queryString}`;
      }
    }

    // Build origin string.
    const port = request.port ? `:${request.port}` : "";
    let origin: string;
    if (request.username != null || request.password != null) {
      const username = request.username ?? "";
      const password = request.password ?? "";
      origin = `${request.protocol}//${username}:${password}@${request.hostname}${port}`;
    } else {
      origin = `${request.protocol}//${request.hostname}${port}`;
    }

    // Strip the Expect header — undici does not support 100-continue and
    // sends the body immediately, so the header is unnecessary.
    const headers = request.headers;
    if (headers["Expect"] === "100-continue") delete headers["Expect"];
    if (headers["expect"] === "100-continue") delete headers["expect"];

    // Strip transfer-encoding header for streaming bodies — undici manages
    // chunked encoding internally for streams, so the explicit header is not
    // needed and causes issues with content-length negotiation.
    // Uses the same duck-typing check as undici's isStream (pipe + on).
    const body = request.body as Readable | undefined;
    if (body && typeof body.pipe === "function" && typeof body.on === "function") {
      if (headers["transfer-encoding"] === "chunked") delete headers["transfer-encoding"];
      if (headers["Transfer-Encoding"] === "chunked") delete headers["Transfer-Encoding"];
    }

    // greater than 0 number or undefined.
    const timeout: number | undefined = requestTimeout && requestTimeout > 0 ? requestTimeout : undefined;
    const headersTimeout = timeout;
    const bodyTimeout = timeout;

    try {
      const {
        statusCode,
        headers: responseHeaders,
        body: responseBody,
      } = await dispatcher.request({
        origin,
        path,
        method: request.method as Dispatcher.HttpMethod,
        headers,
        body: request.body ?? null,
        headersTimeout,
        bodyTimeout,
        signal: abortSignal as AbortSignal | undefined,
      });

      // Transform undici headers (Record<string, string | string[]>) to HeaderBag (Record<string, string>)
      // Only allocate a new object if multi-value headers are present.
      let transformedHeaders: Record<string, string> | undefined;
      for (const key in responseHeaders) {
        const value = responseHeaders[key];
        if (Array.isArray(value)) {
          if (!transformedHeaders) {
            // Lazily copy all headers seen so far.
            transformedHeaders = {};
            for (const k in responseHeaders) {
              if (k === key) break;
              transformedHeaders[k] = responseHeaders[k] as string;
            }
          }
          transformedHeaders[key] = value.join(", ");
        } else if (transformedHeaders) {
          transformedHeaders[key] = value as string;
        }
      }

      const httpResponse = new HttpResponse({
        statusCode,
        headers: (transformedHeaders ?? responseHeaders) as Record<string, string>,
        body: responseBody,
      });

      // Close the isolated client once the response body stream closes.
      if (isolatedClient) {
        (responseBody as Readable).once("close", () => {
          isolatedClient.close();
        });
      }

      return { response: httpResponse };
    } catch (err: any) {
      // Ensure the isolated client is cleaned up on errors.
      if (isolatedClient) {
        isolatedClient.destroy();
      }

      if (err?.code === "UND_ERR_ABORTED") {
        throw Object.assign(err, { name: "AbortError" });
      }

      if (
        err?.code === "UND_ERR_BODY_TIMEOUT" ||
        err?.code === "UND_ERR_CONNECT_TIMEOUT" ||
        err?.code === "UND_ERR_HEADERS_TIMEOUT"
      ) {
        throw Object.assign(err, { name: "TimeoutError" });
      }

      if (err?.code === "UND_ERR_SOCKET") {
        throw Object.assign(err, { name: "RequestTimeout" });
      }
      throw err;
    }
  }

  public updateHttpClientConfig<K extends keyof UndiciHttpHandlerOptions>(
    key: K,
    value: UndiciHttpHandlerOptions[K]
  ): void {
    if (key !== "dispatcher") {
      (this.config as any)[key] = value;
      return;
    }

    let newDispatcher: Dispatcher;

    if (value === undefined) {
      // Retain existing dispatcher, matching constructor behavior.
      return;
    } else if (isDispatcher(value)) {
      newDispatcher = value;
    } else if (typeof value === "object" && value !== null) {
      // Caller passed Agent.Options — create an Agent for them.
      newDispatcher = new Agent({ allowH2: true, ...(value as Agent.Options) });
    } else {
      throw new Error(
        "updateHttpClientConfig: value for 'dispatcher' must be an instance of undici Dispatcher or Agent.Options."
      );
    }

    // No-op when the same dispatcher instance is reassigned.
    if (newDispatcher === this.config.dispatcher) {
      return;
    }

    // Capture the previous dispatcher before assignment.
    const previousDispatcher = this.config.dispatcher;

    // Close the previous dispatcher regardless of whether it was externally provided.
    // Fire-and-forget: let in-flight requests drain without blocking.
    if (previousDispatcher) {
      previousDispatcher.close();
    }

    // Assign the new value.
    this.config.dispatcher = newDispatcher;
  }

  public httpHandlerConfigs(): { dispatcher?: Dispatcher; logger?: Logger } {
    return { ...this.config };
  }

  /**
   * Creates a one-off undici Client for an event stream request.
   * This mirrors NodeHttp2Handler's isolated session behavior — the event stream
   * gets its own dedicated connection that isn't shared with the connection pool.
   */
  private createIsolatedClient(request: HttpRequest): Client {
    const port = request.port ? `:${request.port}` : "";
    let origin: string;
    if (request.username != null || request.password != null) {
      const username = request.username ?? "";
      const password = request.password ?? "";
      origin = `${request.protocol}//${username}:${password}@${request.hostname}${port}`;
    } else {
      origin = `${request.protocol}//${request.hostname}${port}`;
    }

    return new Client(origin, {
      allowH2: true,
      pipelining: 0, // no pipelining — dedicated connection
    });
  }

  private getOrCreateDispatcher(): Dispatcher {
    const { config } = this;
    const { dispatcher } = config;

    if (dispatcher) {
      return dispatcher;
    }

    return (config.dispatcher = new Agent({ allowH2: true }));
  }
}
