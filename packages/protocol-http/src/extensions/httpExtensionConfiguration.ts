import { HttpHandler } from "../httpHandler";

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
 * @internal
 *
 * Helper function to resolve default extension configuration from runtime config
 */
export const getHttpHandlerExtensionConfiguration = <HandlerConfig extends object = {}>(
  runtimeConfig: HttpHandlerExtensionConfigType<HandlerConfig>
) => {
  let httpHandler = runtimeConfig.httpHandler!;
  return {
    setHttpHandler(handler: HttpHandler<HandlerConfig>): void {
      httpHandler = handler;
    },
    httpHandler(): HttpHandler<HandlerConfig> {
      return httpHandler;
    },
    updateHttpClientConfig(key: keyof HandlerConfig, value: HandlerConfig[typeof key]): void {
      httpHandler.updateHttpClientConfig(key, value);
    },
    httpHandlerConfigs(): HandlerConfig {
      return httpHandler.httpHandlerConfigs();
    },
  };
};

/**
 * @internal
 *
 * Helper function to resolve runtime config from default extension configuration
 */
export const resolveHttpHandlerRuntimeConfig = <HandlerConfig extends object = {}>(
  httpHandlerExtensionConfiguration: HttpHandlerExtensionConfiguration<HandlerConfig>
): HttpHandlerExtensionConfigType<HandlerConfig> => {
  return {
    httpHandler: httpHandlerExtensionConfiguration.httpHandler(),
  };
};
