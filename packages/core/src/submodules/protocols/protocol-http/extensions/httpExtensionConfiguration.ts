import type { Logger } from "@smithy/types";

import type { HttpHandler } from "../httpHandler";

/**
 * @internal
 */
export interface HttpHandlerExtensionConfiguration<HandlerConfig extends object = {}> {
  setHttpHandler(handler: HttpHandler<HandlerConfig>): void;
  httpHandler(): HttpHandler<HandlerConfig>;
  updateHttpClientConfig(key: keyof HandlerConfig, value: HandlerConfig[typeof key]): void;
  httpHandlerConfigs(): HandlerConfig;
}

/**
 * @internal
 */
export type HttpHandlerExtensionConfigType<HandlerConfig extends object = {}> = Partial<{
  requestHandler: HttpHandler<HandlerConfig>;
}>;

/**
 * Helper function to resolve default extension configuration from runtime config
 *
 * @internal
 */
export const getHttpHandlerExtensionConfiguration = <HandlerConfig extends { logger?: Logger }>(
  runtimeConfig: HttpHandlerExtensionConfigType<HandlerConfig> & { logger?: Logger }
) => {
  // Offer the client's logger under `Symbol.for("logger")`. A symbol keeps this
  // off the handlers' public options types, and being a symbol already
  // distinguishes it from the `"logger"` string key. `Symbol.for` means each
  // handler can declare its own copy of the key and still compare equal to it.
  //
  // Offered as a fallback only: the handler keeps its own logger if it has one.
  // A NoOpLogger is not offered at all, so that handlers fall through to their
  // own console-based defaults instead of being silenced.
  if (runtimeConfig.logger && runtimeConfig.logger.constructor?.name !== "NoOpLogger") {
    runtimeConfig.requestHandler?.updateHttpClientConfig?.(
      Symbol.for("logger") as unknown as keyof HandlerConfig,
      runtimeConfig.logger as HandlerConfig[keyof HandlerConfig]
    );
  }

  return {
    setHttpHandler(handler: HttpHandler<HandlerConfig>): void {
      runtimeConfig.requestHandler = handler;
    },
    httpHandler(): HttpHandler<HandlerConfig> {
      return runtimeConfig.requestHandler!;
    },
    updateHttpClientConfig(key: keyof HandlerConfig, value: HandlerConfig[typeof key]): void {
      runtimeConfig.requestHandler?.updateHttpClientConfig(key, value);
    },
    httpHandlerConfigs(): HandlerConfig {
      return runtimeConfig.requestHandler!.httpHandlerConfigs();
    },
  };
};

/**
 * Helper function to resolve runtime config from default extension configuration
 *
 * @internal
 */
export const resolveHttpHandlerRuntimeConfig = <HandlerConfig extends object = {}>(
  httpHandlerExtensionConfiguration: HttpHandlerExtensionConfiguration<HandlerConfig>
): HttpHandlerExtensionConfigType<HandlerConfig> => {
  return {
    requestHandler: httpHandlerExtensionConfiguration.httpHandler(),
  };
};
