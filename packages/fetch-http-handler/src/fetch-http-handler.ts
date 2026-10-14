import { HttpResponse, buildQueryString, type HttpHandler, type HttpRequest } from "@smithy/core/protocols";
import type { FetchHttpHandlerOptions, HeaderBag, HttpHandlerOptions, Provider } from "@smithy/types";

import { createRequest } from "./create-request";
import { requestTimeout as requestTimeoutFn } from "./request-timeout";
import { createSocketTimeoutMonitor } from "./socket-timeout";

declare let AbortController: any;

/**
 * @public
 */
export type { FetchHttpHandlerOptions };

/**
 * Detection of keepalive support. Can be overridden for testing.
 *
 * @internal
 */
export const keepAliveSupport = {
  supported: undefined as undefined | boolean,
};

/**
 * @internal
 */
export type AdditionalRequestParameters = {
  // This is required in Node.js when Request has a body, and does nothing in the browser.
  // Duplex: half means the request is fully transmitted before attempting to process the response.
  // As of writing this is the only accepted value in https://fetch.spec.whatwg.org/.
  duplex?: "half";
};

/**
 * HttpHandler implementation using browsers' `fetch` global function.
 *
 * @public
 */
export class FetchHttpHandler implements HttpHandler<FetchHttpHandlerOptions> {
  private config?: FetchHttpHandlerOptions;
  private configProvider: Promise<FetchHttpHandlerOptions>;

  /**
   * @returns the input if it is an HttpHandler of any class,
   * or instantiates a new instance of this handler.
   */
  public static create(
    instanceOrOptions?: HttpHandler<any> | FetchHttpHandlerOptions | Provider<FetchHttpHandlerOptions | void>
  ) {
    if (typeof (instanceOrOptions as any)?.handle === "function") {
      // is already an instance of HttpHandler.
      return instanceOrOptions as HttpHandler<any>;
    }
    // input is ctor options or undefined.
    return new FetchHttpHandler(instanceOrOptions as FetchHttpHandlerOptions);
  }

  constructor(options?: FetchHttpHandlerOptions | Provider<FetchHttpHandlerOptions | void>) {
    if (typeof options === "function") {
      this.configProvider = options().then((opts) => opts || {});
    } else {
      this.config = options ?? {};
      this.configProvider = Promise.resolve(this.config);
    }
    if (keepAliveSupport.supported === undefined) {
      keepAliveSupport.supported = Boolean(
        typeof Request !== "undefined" && "keepalive" in createRequest("https://[::1]")
      );
    }
  }

  destroy(): void {
    // Do nothing. TLS and HTTP/2 connection pooling is handled by the browser.
  }

  async handle(
    request: HttpRequest,
    { abortSignal, requestTimeout }: HttpHandlerOptions = {}
  ): Promise<{ response: HttpResponse }> {
    if (!this.config) {
      this.config = await this.configProvider;
    }
    const requestTimeoutInMs = requestTimeout ?? this.config!.requestTimeout;
    // JS-7140: the download-inactivity window.
    const socketTimeoutInMs = this.config!.socketTimeout;
    const keepAlive = this.config!.keepAlive === true;
    const credentials = this.config!.credentials as RequestInit["credentials"];
    const fetchFn = this.config!.customFetch ?? fetch;

    // if the request was already aborted, prevent doing extra work
    if (abortSignal?.aborted) {
      const abortError = buildAbortError(abortSignal);
      return Promise.reject(abortError);
    }

    let path = request.path;
    const queryString = buildQueryString(request.query || {});
    if (queryString) {
      path += `?${queryString}`;
    }
    if (request.fragment) {
      path += `#${request.fragment}`;
    }

    let auth = "";
    if (request.username != null || request.password != null) {
      const username = request.username ?? "";
      const password = request.password ?? "";
      auth = `${username}:${password}@`;
    }

    const { port, method } = request;
    const url = `${request.protocol}//${auth}${request.hostname}${port ? `:${port}` : ""}${path}`;
    // Request constructor doesn't allow GET/HEAD request with body
    // ref: https://github.com/whatwg/fetch/issues/551
    const body = method === "GET" || method === "HEAD" ? undefined : request.body;
    const requestOptions: RequestInit & AdditionalRequestParameters = {
      body,
      headers: new Headers(request.headers),
      method: method,
      credentials,
    };
    // cache property is not supported in workerd runtime
    // TODO: can we feature detect support for cache and not set this property when not supported?
    if (this.config?.cache) {
      requestOptions.cache = this.config.cache;
    }

    if (body) {
      requestOptions.duplex = "half";
    }

    // some browsers support abort signal
    if (typeof AbortController !== "undefined") {
      requestOptions.signal = abortSignal as AbortSignal;
    }

    // some browsers support keepalive
    if (keepAliveSupport.supported) {
      requestOptions.keepalive = keepAlive;
    }

    if (typeof this.config.requestInit === "function") {
      Object.assign(requestOptions, this.config.requestInit(request));
    }

    let removeSignalEventListener = () => {};

    // JS-7140: arm the download-inactivity monitor at dispatch, so the wait
    // before the first byte is covered. Only engaged for a positive value.
    const socketTimeoutMonitor =
      socketTimeoutInMs && socketTimeoutInMs > 0 && typeof AbortController !== "undefined"
        ? createSocketTimeoutMonitor(socketTimeoutInMs)
        : undefined;
    // A monitored stream owns the timer (re-arms per chunk, clears on end), so the
    // race's finally must not clear it; every other settle path does.
    let monitoredStreamOwnsTimer = false;
    if (socketTimeoutMonitor) {
      // The signal fetch would otherwise receive: the caller's abortSignal, or one
      // supplied through requestInit. Forward its abort to the monitor's controller,
      // and keep forwarding until the monitor settles so a caller abort still cancels
      // a monitored body mid-download. Signals without addEventListener (legacy) are
      // not forwarded; the race below still rejects on them as before.
      const upstreamSignal = requestOptions.signal as AbortSignal | null | undefined;
      requestOptions.signal = socketTimeoutMonitor.controller.signal;
      if (upstreamSignal && typeof upstreamSignal.addEventListener === "function") {
        const forwardAbort = () => socketTimeoutMonitor.controller.abort(buildAbortError(upstreamSignal));
        if (upstreamSignal.aborted) {
          forwardAbort();
        } else {
          upstreamSignal.addEventListener("abort", forwardAbort, { once: true });
          socketTimeoutMonitor.onSettled(() => upstreamSignal.removeEventListener("abort", forwardAbort));
        }
      }
    }

    const fetchRequest = createRequest(url, requestOptions);
    const raceOfPromises = [
      fetchFn(fetchRequest).then((response) => {
        // Response headers are activity: restart the window before the body wait.
        socketTimeoutMonitor?.reset();
        const fetchHeaders: any = response.headers;
        const transformedHeaders: HeaderBag = {};

        for (const pair of <Array<string[]>>fetchHeaders.entries()) {
          transformedHeaders[pair[0]] = pair[1];
        }

        // Check for undefined as well as null.
        const hasReadableStream = response.body != undefined;

        // Return the response with buffered body
        if (!hasReadableStream) {
          // No streaming body (stock React Native): no chunks to reset on, so the
          // dispatch-armed window stands alone. Clear it once the body is in hand.
          return response.blob().then((body) => {
            socketTimeoutMonitor?.clear();
            return {
              response: new HttpResponse({
                headers: transformedHeaders,
                reason: response.statusText,
                statusCode: response.status,
                body,
              }),
            };
          });
        }
        // Streaming body: wrap it so each chunk resets the window; it owns the timer now.
        let body = response.body;
        if (socketTimeoutMonitor && body) {
          body = socketTimeoutMonitor.monitor(body);
          monitoredStreamOwnsTimer = true;
        }
        return {
          response: new HttpResponse({
            headers: transformedHeaders,
            reason: response.statusText,
            statusCode: response.status,
            body,
          }),
        };
      }),
      requestTimeoutFn(requestTimeoutInMs),
    ];
    if (socketTimeoutMonitor) {
      raceOfPromises.push(socketTimeoutMonitor.timeoutPromise);
    }
    if (abortSignal) {
      raceOfPromises.push(
        new Promise<never>((resolve, reject) => {
          const onAbort = () => {
            const abortError = buildAbortError(abortSignal);
            reject(abortError);
          };
          if (typeof (abortSignal as AbortSignal).addEventListener === "function") {
            // preferred.
            const signal = abortSignal as AbortSignal;
            signal.addEventListener("abort", onAbort, { once: true });
            removeSignalEventListener = () => signal.removeEventListener("abort", onAbort);
          } else {
            // backwards compatibility
            abortSignal.onabort = onAbort;
          }
        })
      );
    }
    return Promise.race(raceOfPromises).finally(() => {
      removeSignalEventListener();
      // A monitored stream clears the timer on its own end; otherwise clear here.
      if (!monitoredStreamOwnsTimer) {
        socketTimeoutMonitor?.clear();
      }
    });
  }

  updateHttpClientConfig(key: keyof FetchHttpHandlerOptions, value: FetchHttpHandlerOptions[typeof key]): void {
    this.config = undefined;
    this.configProvider = this.configProvider.then((config) => {
      (config as Record<typeof key, typeof value>)[key] = value;
      return config;
    });
  }

  httpHandlerConfigs(): FetchHttpHandlerOptions {
    return this.config ?? {};
  }
}

/**
 * Builds an abort error, using the AbortSignal's reason if available.
 */
function buildAbortError(abortSignal?: unknown): Error {
  const reason =
    abortSignal && typeof abortSignal === "object" && "reason" in abortSignal
      ? (abortSignal as { reason?: unknown }).reason
      : undefined;
  if (reason) {
    if (reason instanceof Error) {
      const abortError = new Error("Request aborted");
      abortError.name = "AbortError";
      (abortError as { cause?: unknown }).cause = reason;
      return abortError;
    }
    const abortError = new Error(String(reason));
    abortError.name = "AbortError";
    return abortError;
  }
  const abortError = new Error("Request aborted");
  abortError.name = "AbortError";
  return abortError;
}
