import { HttpHandler, HttpRequest, HttpResponse } from "@smithy/protocol-http";
import { buildQueryString } from "@smithy/querystring-builder";
import type { Logger, NodeHttpHandlerOptions } from "@smithy/types";
import { HttpHandlerOptions, Provider } from "@smithy/types";
import { Agent as hAgent, request as hRequest } from "http";
import { Agent as hsAgent, request as hsRequest, RequestOptions } from "https";

import { NODEJS_TIMEOUT_ERROR_CODES } from "./constants";
import { getTransformedHeaders } from "./get-transformed-headers";
import { setConnectionTimeout } from "./set-connection-timeout";
import { setSocketKeepAlive } from "./set-socket-keep-alive";
import { setSocketTimeout } from "./set-socket-timeout";
import { writeRequestBody } from "./write-request-body";

export { NodeHttpHandlerOptions };

interface ResolvedNodeHttpHandlerConfig extends Omit<NodeHttpHandlerOptions, "httpAgent" | "httpsAgent"> {
  httpAgent: hAgent;
  httpsAgent: hsAgent;
}

export const DEFAULT_REQUEST_TIMEOUT = 0;

export class NodeHttpHandler implements HttpHandler<NodeHttpHandlerOptions> {
  private config?: ResolvedNodeHttpHandlerConfig;
  private configProvider: Promise<ResolvedNodeHttpHandlerConfig>;
  private socketWarningTimestamp = 0;

  // Node http handler is hard-coded to http/1.1: https://github.com/nodejs/node/blob/ff5664b83b89c55e4ab5d5f60068fb457f1f5872/lib/_http_server.js#L286
  public readonly metadata = { handlerProtocol: "http/1.1" };

  /**
   * @returns the input if it is an HttpHandler of any class,
   * or instantiates a new instance of this handler.
   */
  public static create(
    instanceOrOptions?: HttpHandler<any> | NodeHttpHandlerOptions | Provider<NodeHttpHandlerOptions | void>
  ) {
    if (typeof (instanceOrOptions as any)?.handle === "function") {
      // is already an instance of HttpHandler.
      return instanceOrOptions as HttpHandler<any>;
    }
    // input is ctor options or undefined.
    return new NodeHttpHandler(instanceOrOptions as NodeHttpHandlerOptions);
  }

  /**
   * @internal
   *
   * @param agent - http(s) agent in use by the NodeHttpHandler instance.
   * @param socketWarningTimestamp - last socket usage check timestamp.
   * @param logger - channel for the warning.
   * @returns timestamp of last emitted warning.
   */
  public static checkSocketUsage(
    agent: hAgent | hsAgent,
    socketWarningTimestamp: number,
    logger: Logger = console
  ): number {
    // note, maxSockets is per origin.
    const { sockets, requests, maxSockets } = agent;

    if (typeof maxSockets !== "number" || maxSockets === Infinity) {
      return socketWarningTimestamp;
    }

    const interval = 15_000;
    if (Date.now() - interval < socketWarningTimestamp) {
      return socketWarningTimestamp;
    }

    if (sockets && requests) {
      for (const origin in sockets) {
        const socketsInUse = sockets[origin]?.length ?? 0;
        const requestsEnqueued = requests[origin]?.length ?? 0;

        /**
         * Running at maximum socket usage can be intentional and normal.
         * That is why this warning emits at a delay which can be seen
         * at the call site's setTimeout wrapper. The warning will be cancelled
         * if the request finishes in a reasonable amount of time regardless
         * of socket saturation.
         *
         * Additionally, when the warning is emitted, there is an interval
         * lockout.
         */
        if (socketsInUse >= maxSockets && requestsEnqueued >= 2 * maxSockets) {
          logger?.warn?.(
            `@smithy/node-http-handler:WARN - socket usage at capacity=${socketsInUse} and ${requestsEnqueued} additional requests are enqueued.
See https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/node-configuring-maxsockets.html
or increase socketAcquisitionWarningTimeout=(millis) in the NodeHttpHandler config.`
          );
          return Date.now();
        }
      }
    }

    return socketWarningTimestamp;
  }

  constructor(options?: NodeHttpHandlerOptions | Provider<NodeHttpHandlerOptions | void>) {
    this.configProvider = new Promise((resolve, reject) => {
      if (typeof options === "function") {
        options()
          .then((_options) => {
            resolve(this.resolveDefaultConfig(_options));
          })
          .catch(reject);
      } else {
        resolve(this.resolveDefaultConfig(options));
      }
    });
  }

  private resolveDefaultConfig(options?: NodeHttpHandlerOptions | void): ResolvedNodeHttpHandlerConfig {
    const { requestTimeout, connectionTimeout, socketTimeout, httpAgent, httpsAgent } = options || {};
    const keepAlive = true;
    const maxSockets = 50;

    return {
      connectionTimeout,
      requestTimeout: requestTimeout ?? socketTimeout,
      httpAgent: (() => {
        if (httpAgent instanceof hAgent || typeof (httpAgent as hAgent)?.destroy === "function") {
          return httpAgent as hAgent;
        }
        return new hAgent({ keepAlive, maxSockets, ...httpAgent });
      })(),
      httpsAgent: (() => {
        if (httpsAgent instanceof hsAgent || typeof (httpsAgent as hsAgent)?.destroy === "function") {
          return httpsAgent as hsAgent;
        }
        return new hsAgent({ keepAlive, maxSockets, ...httpsAgent });
      })(),
      logger: console,
    };
  }

  destroy(): void {
    this.config?.httpAgent?.destroy();
    this.config?.httpsAgent?.destroy();
  }

  async handle(request: HttpRequest, { abortSignal }: HttpHandlerOptions = {}): Promise<{ response: HttpResponse }> {
    if (!this.config) {
      this.config = await this.configProvider;
    }

    return new Promise((_resolve, _reject) => {
      let writeRequestBodyPromise: Promise<void> | undefined = undefined;

      // Timeouts related to this request to clear upon completion.
      const timeouts = [] as (number | NodeJS.Timeout)[];

      const resolve = async (arg: { response: HttpResponse }) => {
        await writeRequestBodyPromise;
        timeouts.forEach(clearTimeout);
        _resolve(arg);
      };
      const reject = async (arg: unknown) => {
        await writeRequestBodyPromise;
        timeouts.forEach(clearTimeout);
        _reject(arg);
      };

      if (!this.config) {
        throw new Error("Node HTTP request handler config is not resolved");
      }

      // if the request was already aborted, prevent doing extra work
      if (abortSignal?.aborted) {
        const abortError = new Error("Request aborted");
        abortError.name = "AbortError";
        reject(abortError);
        return;
      }

      // determine which http(s) client to use
      const isSSL = request.protocol === "https:";
      const agent = isSSL ? this.config.httpsAgent : this.config.httpAgent;

      // If the request is taking a long time, check socket usage and potentially warn.
      // This warning will be cancelled if the request resolves.
      timeouts.push(
        setTimeout(
          () => {
            this.socketWarningTimestamp = NodeHttpHandler.checkSocketUsage(
              agent,
              this.socketWarningTimestamp,
              this.config!.logger
            );
          },
          this.config.socketAcquisitionWarningTimeout ??
            (this.config.requestTimeout ?? 2000) + (this.config.connectionTimeout ?? 1000)
        )
      );

      const queryString = buildQueryString(request.query || {});
      let auth = undefined;
      if (request.username != null || request.password != null) {
        const username = request.username ?? "";
        const password = request.password ?? "";
        auth = `${username}:${password}`;
      }
      let path = request.path;
      if (queryString) {
        path += `?${queryString}`;
      }
      if (request.fragment) {
        path += `#${request.fragment}`;
      }

      let hostname: string;
      if (request.hostname.startsWith("[") && request.hostname.endsWith("]")) {
        hostname = request.hostname.slice(1, -1);
      } else {
        hostname = request.hostname;
      }

      const nodeHttpsOptions: RequestOptions = {
        headers: request.headers,
        host: hostname,
        method: request.method,
        path,
        port: request.port,
        agent,
        auth,
      };

      // create the http request
      const requestFunc = isSSL ? hsRequest : hRequest;

      const req = requestFunc(nodeHttpsOptions, (res) => {
        const httpResponse = new HttpResponse({
          statusCode: res.statusCode || -1,
          reason: res.statusMessage,
          headers: getTransformedHeaders(res.headers),
          body: res,
        });
        resolve({ response: httpResponse });
      });

      req.on("error", (err: Error) => {
        if (NODEJS_TIMEOUT_ERROR_CODES.includes((err as any).code)) {
          reject(Object.assign(err, { name: "TimeoutError" }));
        } else {
          reject(err);
        }
      });

      // wire-up abort logic
      if (abortSignal) {
        const onAbort = () => {
          // ensure request is destroyed
          req.destroy();
          const abortError = new Error("Request aborted");
          abortError.name = "AbortError";
          reject(abortError);
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

      // Defer registration of socket event listeners if the connection and request timeouts
      // are longer than a few seconds. This avoids slowing down faster operations.
      timeouts.push(setConnectionTimeout(req, reject, this.config.connectionTimeout));
      timeouts.push(setSocketTimeout(req, reject, this.config.requestTimeout));

      // Workaround for bug report in Node.js https://github.com/nodejs/node/issues/47137
      const httpAgent = nodeHttpsOptions.agent;
      if (typeof httpAgent === "object" && "keepAlive" in httpAgent) {
        timeouts.push(
          setSocketKeepAlive(req, {
            // @ts-expect-error keepAlive is not public on httpAgent.
            keepAlive: (httpAgent as hAgent).keepAlive,
            // @ts-expect-error keepAliveMsecs is not public on httpAgent.
            keepAliveMsecs: (httpAgent as hAgent).keepAliveMsecs,
          })
        );
      }

      writeRequestBodyPromise = writeRequestBody(req, request, this.config.requestTimeout).catch((e) => {
        timeouts.forEach(clearTimeout);
        return _reject(e);
      });
    });
  }

  updateHttpClientConfig(key: keyof NodeHttpHandlerOptions, value: NodeHttpHandlerOptions[typeof key]): void {
    this.config = undefined;
    this.configProvider = this.configProvider.then((config) => {
      return {
        ...config,
        [key]: value,
      };
    });
  }

  httpHandlerConfigs(): NodeHttpHandlerOptions {
    return this.config ?? {};
  }
}
