import type { HttpHandler, HttpRequest } from "@smithy/protocol-http";
import { HttpResponse } from "@smithy/protocol-http";
import { buildQueryString } from "@smithy/querystring-builder";
import type { FetchHttpHandlerOptions } from "@smithy/types";
import type { HeaderBag, HttpHandlerOptions, Provider } from "@smithy/types";

import { createRequest } from "./create-request";
import { requestTimeout as requestTimeoutFn } from "./request-timeout";

declare let AbortController: any;

/**
 * @public
 */
export { FetchHttpHandlerOptions };

/**
 * @internal
 * Detection of keepalive support. Can be overridden for testing.
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
 * @public
 *
 * HttpHandler implementation using browsers' `fetch` global function.
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
    const keepAlive = this.config!.keepAlive === true;
    const credentials = this.config!.credentials as RequestInit["credentials"];

    // if the request was already aborted, prevent doing extra work
    if (abortSignal?.aborted) {
      const abortError = new Error("Request aborted");
      abortError.name = "AbortError";
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

    const fetchRequest = createRequest(url, requestOptions);
    const raceOfPromises = [
      fetch(fetchRequest).then((response) => {
        const fetchHeaders: any = response.headers;
        const transformedHeaders: HeaderBag = {};

        for (const pair of <Array<string[]>>fetchHeaders.entries()) {
          transformedHeaders[pair[0]] = pair[1];
        }

        // Check for undefined as well as null.
        const hasReadableStream = response.body != undefined;

        // Return the response with buffered body
        if (!hasReadableStream) {
          return response.blob().then((body) => ({
            response: new HttpResponse({
              headers: transformedHeaders,
              reason: response.statusText,
              statusCode: response.status,
              body,
            }),
          }));
        }
        // Return the response with streaming body
        return {
          response: new HttpResponse({
            headers: transformedHeaders,
            reason: response.statusText,
            statusCode: response.status,
            body: response.body,
          }),
        };
      }),
      requestTimeoutFn(requestTimeoutInMs),
    ];
    if (abortSignal) {
      raceOfPromises.push(
        new Promise<never>((resolve, reject) => {
          const onAbort = () => {
            const abortError = new Error("Request aborted");
            abortError.name = "AbortError";
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
    return Promise.race(raceOfPromises).finally(removeSignalEventListener);
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
