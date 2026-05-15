import type { Readable } from "node:stream";
import { HttpResponse, buildQueryString, type HttpHandler, type HttpRequest } from "@smithy/core/protocols";
import type { HttpHandlerOptions, Logger } from "@smithy/types";
import { Agent, Dispatcher } from "undici";

/**
 * Duck-type check: returns true if the value looks like a Dispatcher
 * (has a `request` method), as opposed to plain Agent.Options.
 */
const isDispatcher = (value: unknown): value is Dispatcher =>
  value instanceof Dispatcher ||
  (typeof value === "object" && value !== null && typeof (value as any).request === "function");

/**
 * Options for the UndiciHttpHandler.
 *
 * @public
 */
export interface UndiciHttpHandlerOptions {
  /**
   * You can pass an existing undici Dispatcher (Agent, Pool, Client, etc.)
   * or Agent.Options to have one created for you.
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
  private externalDispatcher = false;

  constructor(options?: UndiciHttpHandlerOptions) {
    if (options?.dispatcher && isDispatcher(options.dispatcher)) {
      this.config = { ...options, dispatcher: options.dispatcher };
      this.externalDispatcher = true;
    } else if (options?.dispatcher) {
      // Caller passed Agent.Options — create an Agent for them.
      this.config = { ...options, dispatcher: new Agent({ allowH2: true, ...options.dispatcher }) };
    } else {
      this.config = { ...options } as { dispatcher?: Dispatcher; logger?: Logger };
    }
  }

  public destroy(): void {
    if (this.config.dispatcher && !this.externalDispatcher) {
      this.config.dispatcher.destroy();
      this.config.dispatcher = undefined;
    }
  }

  public async handle(
    request: HttpRequest,
    { abortSignal, requestTimeout }: HttpHandlerOptions = {}
  ): Promise<{ response: HttpResponse }> {
    const dispatcher = this.getOrCreateDispatcher();

    if (abortSignal?.aborted) {
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
    if (request.fragment) {
      path += `#${request.fragment}`;
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
      const transformedHeaders: Record<string, string> = {};
      for (const key in responseHeaders) {
        const value = responseHeaders[key];
        if (value !== undefined) {
          transformedHeaders[key] = Array.isArray(value) ? value.join(", ") : value;
        }
      }

      const httpResponse = new HttpResponse({
        statusCode,
        headers: transformedHeaders,
        body: responseBody,
      });

      return { response: httpResponse };
    } catch (err: any) {
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
    value: NonNullable<UndiciHttpHandlerOptions[K]>
  ): void {
    if (key !== "dispatcher") {
      (this.config as any)[key] = value;
      return;
    }

    let newDispatcher: Dispatcher;
    let isExternal: boolean;

    if (isDispatcher(value)) {
      newDispatcher = value;
      isExternal = true;
    } else if (typeof value === "object" && value !== null) {
      // Caller passed Agent.Options — create an Agent for them.
      newDispatcher = new Agent({ allowH2: true, ...(value as Agent.Options) });
      isExternal = false;
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

    // Destroy the previous dispatcher only if it was internally created.
    if (previousDispatcher && !this.externalDispatcher) {
      previousDispatcher.destroy();
    }

    // Assign the new value and update externalDispatcher based on it.
    this.config.dispatcher = newDispatcher;
    this.externalDispatcher = isExternal;
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

    return (config.dispatcher = new Agent({ allowH2: true }));
  }
}
