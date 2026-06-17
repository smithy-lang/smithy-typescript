import type { Readable } from "node:stream";
import { HttpResponse, buildQueryString, type HttpHandler, type HttpRequest } from "@smithy/core/protocols";
import type { HttpHandlerOptions, Logger } from "@smithy/types";
import { Agent, Dispatcher } from "undici";

import { buildAbortError } from "./build-abort-error";

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
 * An HTTP handler that uses undici instead of Node.js native http/https modules.
 * Smithy-compatible request handler backed by undici.
 *
 * @public
 */
export class UndiciHttpHandler implements HttpHandler<UndiciHttpHandlerOptions> {
  private config: { dispatcher?: Dispatcher; logger?: Logger };

  /**
   * Options used to construct the internally-managed Agent, retained so the
   * Agent can be created lazily on the first request. This preserves
   * caller-configured TLS, connect, and timeout settings.
   */
  private internalAgentOptions?: Agent.Options;

  constructor(options?: UndiciHttpHandlerOptions) {
    if (options?.dispatcher && isDispatcher(options.dispatcher)) {
      this.config = { ...options, dispatcher: options.dispatcher };
    } else if (options?.dispatcher) {
      // Caller passed Agent.Options — store them and defer Agent creation
      // until the first request, so we don't pay for an unused dispatcher
      // (e.g. when the handler is constructed but never invoked).
      this.internalAgentOptions = { allowH2: true, ...options.dispatcher };
      const { dispatcher: _ignored, ...rest } = options;
      this.config = rest;
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
    { abortSignal, requestTimeout }: HttpHandlerOptions = {}
  ): Promise<{ response: HttpResponse }> {
    const dispatcher = this.getOrCreateDispatcher();

    if (abortSignal?.aborted) {
      throw buildAbortError(abortSignal);
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

      return { response: httpResponse };
    } catch (err: any) {
      if (err?.code === "UND_ERR_ABORTED") {
        // Preserve the abort reason from the signal as `cause` so callers can
        // distinguish user-provided abort reasons from undici's generic abort.
        const reason =
          abortSignal && typeof abortSignal === "object" && "reason" in abortSignal
            ? (abortSignal as { reason?: unknown }).reason
            : undefined;
        const assigned: { name: string; cause?: unknown } = { name: "AbortError" };
        if (reason !== undefined && (err as { cause?: unknown }).cause === undefined) {
          assigned.cause = reason;
        }
        throw Object.assign(err, assigned);
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

    if (value === undefined) {
      // Retain existing dispatcher, matching constructor behavior.
      return;
    }

    if (isDispatcher(value)) {
      // No-op when the same dispatcher instance is reassigned.
      if (value === this.config.dispatcher) {
        return;
      }

      const previousDispatcher = this.config.dispatcher;
      // Close the previous dispatcher regardless of whether it was externally provided.
      // Fire-and-forget: let in-flight requests drain without blocking.
      if (previousDispatcher) {
        previousDispatcher.close();
      }

      this.config.dispatcher = value;
      this.internalAgentOptions = undefined;
      return;
    }

    if (typeof value === "object" && value !== null) {
      // Caller passed Agent.Options — defer Agent creation to first request.
      const previousDispatcher = this.config.dispatcher;
      if (previousDispatcher) {
        previousDispatcher.close();
      }

      this.internalAgentOptions = { allowH2: true, ...(value as Agent.Options) };
      this.config.dispatcher = undefined;
      return;
    }

    throw new Error(
      "updateHttpClientConfig: value for 'dispatcher' must be an instance of undici Dispatcher or Agent.Options."
    );
  }

  public httpHandlerConfigs(): { dispatcher?: Dispatcher; logger?: Logger } {
    return { ...this.config };
  }

  private getOrCreateDispatcher(): Dispatcher {
    const { config } = this;
    const { dispatcher } = config;

    if (dispatcher) {
      return dispatcher;
    }

    return (config.dispatcher = new Agent(this.internalAgentOptions ?? { allowH2: true }));
  }
}
