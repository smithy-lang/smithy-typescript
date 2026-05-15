import type { Readable } from "node:stream";
import { HttpResponse, buildQueryString, type HttpHandler, type HttpRequest } from "@smithy/core/protocols";
import type { HttpHandlerOptions, Logger } from "@smithy/types";
import { Agent, Dispatcher } from "undici";

/**
 * Options for the UndiciHttpHandler.
 */
export interface UndiciHttpHandlerOptions {
  /**
   * An existing undici Dispatcher (Agent, Pool, Client, etc.) to use.
   */
  dispatcher?: Dispatcher;

  /**
   * Optional logger.
   */
  logger?: Logger;
}

/**
 * An HTTP handler that uses undici instead of Node.js native http/https modules.
 * Smithy-compatible request handler backed by undici.
 */
export class UndiciHttpHandler implements HttpHandler<UndiciHttpHandlerOptions> {
  private config: UndiciHttpHandlerOptions;
  private externalDispatcher = false;

  constructor(options?: UndiciHttpHandlerOptions) {
    this.config = { ...options };
    if (this.config.dispatcher) {
      this.externalDispatcher = true;
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
    if ("Expect" in headers) delete headers["Expect"];
    if ("expect" in headers) delete headers["expect"];

    // Strip transfer-encoding header for streaming bodies — undici manages
    // chunked encoding internally for streams, so the explicit header is not
    // needed and causes issues with content-length negotiation.
    // Uses the same duck-typing check as undici's isStream (pipe + on).
    const body = request.body as Readable | undefined;
    if (body && typeof body.pipe === "function" && typeof body.on === "function") {
      if ("transfer-encoding" in headers) delete headers["transfer-encoding"];
      if ("Transfer-Encoding" in headers) delete headers["Transfer-Encoding"];
    }

    const headersTimeout = requestTimeout !== undefined ? requestTimeout || undefined : undefined;
    const bodyTimeout = requestTimeout !== undefined ? requestTimeout || undefined : undefined;

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

    // Validate before any side effects so the handler isn't left in a broken state.
    if (!(value instanceof Dispatcher)) {
      throw new Error("updateHttpClientConfig: value for 'dispatcher' must be an instance of undici Dispatcher.");
    }

    // No-op when the same dispatcher instance is reassigned.
    if (value === this.config.dispatcher) {
      return;
    }

    // Capture the previous dispatcher before assignment.
    const previousDispatcher = this.config.dispatcher;

    // Destroy the previous dispatcher only if it was internally created.
    if (previousDispatcher && !this.externalDispatcher) {
      previousDispatcher.destroy();
    }

    // Assign the new value and update externalDispatcher based on it.
    this.config.dispatcher = value as Dispatcher;
    this.externalDispatcher = true;
  }

  public httpHandlerConfigs(): UndiciHttpHandlerOptions {
    return { ...this.config };
  }

  private getOrCreateDispatcher(): Dispatcher {
    if (this.config.dispatcher) {
      return this.config.dispatcher;
    }

    this.config.dispatcher = new Agent({ allowH2: true });

    return this.config.dispatcher;
  }
}
