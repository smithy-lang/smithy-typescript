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
  httpHandler: HttpHandler<HandlerConfig>;
}>;

/**
 * Helper function to resolve default extension configuration from runtime config
 *
 * @internal
 */
export const getHttpHandlerExtensionConfiguration = <HandlerConfig extends object = {}>(
  runtimeConfig: HttpHandlerExtensionConfigType<HandlerConfig>
) => {
  return {
    setHttpHandler(handler: HttpHandler<HandlerConfig>): void {
      runtimeConfig.httpHandler = handler;
    },
    httpHandler(): HttpHandler<HandlerConfig> {
      return runtimeConfig.httpHandler!;
    },
    updateHttpClientConfig(key: keyof HandlerConfig, value: HandlerConfig[typeof key]): void {
      runtimeConfig.httpHandler?.updateHttpClientConfig(key, value);
    },
    httpHandlerConfigs(): HandlerConfig {
      return runtimeConfig.httpHandler!.httpHandlerConfigs();
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
    httpHandler: httpHandlerExtensionConfiguration.httpHandler(),
  };
};
