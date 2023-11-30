import { HttpHandler, HttpRequest, HttpResponse } from "@smithy/protocol-http";
import { buildQueryString } from "@smithy/querystring-builder";
import { HeaderBag, HttpHandlerOptions, Provider } from "@smithy/types";

import { requestTimeout } from "./request-timeout";

declare let AbortController: any;

/**
 * Represents the http options that can be passed to a browser http client.
 */
export interface FetchHttpHandlerOptions {
  /**
   * The number of milliseconds a request can take before being automatically
   * terminated.
   */
  requestTimeout?: number;

  /**
   * Whether to allow the request to outlive the page. Default value is false.
   *
   * There may be limitations to the payload size, number of concurrent requests,
   * request duration etc. when using keepalive in browsers.
   *
   * These may change over time, so look for up to date information about
   * these limitations before enabling keepalive.
   */
  keepAlive?: boolean;
}

type FetchHttpHandlerConfig = FetchHttpHandlerOptions;

/**
 * @internal
 * Detection of keepalive support. Can be overridden for testing.
 */
export const keepAliveSupport = {
  supported: Boolean(typeof Request !== "undefined" && "keepalive" in new Request("https://[::1]")),
};

/**
 * @public
 *
 * HttpHandler implementation using browsers' `fetch` global function.
 */
export class FetchHttpHandler implements HttpHandler<FetchHttpHandlerConfig> {
  private config?: FetchHttpHandlerConfig;
  private configProvider: Promise<FetchHttpHandlerConfig>;

  /**
   * @returns the input if it is an HttpHandler of any class,
   * or instantiates a new instance of this handler.
   */
  public static create(instanceOrOptions?: HttpHandler<any> | FetchHttpHandlerConfig) {
    if (typeof (instanceOrOptions as any)?.handle === "function") {
      // is already an instance of HttpHandler.
      return instanceOrOptions as HttpHandler<any>;
    }
    // input is ctor options or undefined.
    return new FetchHttpHandler(instanceOrOptions as FetchHttpHandlerConfig);
  }

  constructor(options?: FetchHttpHandlerOptions | Provider<FetchHttpHandlerOptions | undefined>) {
    if (typeof options === "function") {
      this.configProvider = options().then((opts) => opts || {});
    } else {
      this.config = options ?? {};
      this.configProvider = Promise.resolve(this.config);
    }
  }

  destroy(): void {
    // Do nothing. TLS and HTTP/2 connection pooling is handled by the browser.
  }

  async handle(request: HttpRequest, { abortSignal }: HttpHandlerOptions = {}): Promise<{ response: HttpResponse }> {
    if (!this.config) {
      this.config = await this.configProvider;
    }
    const requestTimeoutInMs = this.config!.requestTimeout;
    const keepAlive = this.config!.keepAlive === true;

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
    const requestOptions: RequestInit = { body, headers: new Headers(request.headers), method: method };

    // some browsers support abort signal
    if (typeof AbortController !== "undefined") {
      (requestOptions as any)["signal"] = abortSignal;
    }

    // some browsers support keepalive
    if (keepAliveSupport.supported) {
      (requestOptions as any)["keepalive"] = keepAlive;
    }

    const fetchRequest = new Request(url, requestOptions);
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
      requestTimeout(requestTimeoutInMs),
    ];
    if (abortSignal) {
      raceOfPromises.push(
        new Promise<never>((resolve, reject) => {
          abortSignal.onabort = () => {
            const abortError = new Error("Request aborted");
            abortError.name = "AbortError";
            reject(abortError);
          };
        })
      );
    }
    return Promise.race(raceOfPromises);
  }

  updateHttpClientConfig(key: keyof FetchHttpHandlerConfig, value: FetchHttpHandlerConfig[typeof key]): void {
    this.config = undefined;
    this.configProvider = this.configProvider.then((config) => {
      (config as Record<typeof key, typeof value>)[key] = value;
      return config;
    });
  }

  httpHandlerConfigs(): FetchHttpHandlerConfig {
    return this.config ?? {};
  }
}
