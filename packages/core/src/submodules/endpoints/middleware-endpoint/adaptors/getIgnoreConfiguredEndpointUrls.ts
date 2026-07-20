import { booleanSelector, type LoadedConfigSelectors, SelectorType } from "@smithy/core/config";

/**
 * @internal
 */
export const ENV_IGNORE_CONFIGURED_ENDPOINT_URLS = "AWS_IGNORE_CONFIGURED_ENDPOINT_URLS";

/**
 * @internal
 */
export const CONFIG_IGNORE_CONFIGURED_ENDPOINT_URLS = "ignore_configured_endpoint_urls";

/**
 * Config selectors for the ignore_configured_endpoint_urls option.
 * When true, configured endpoint URLs from environment variables
 * and the shared configuration file are not used.
 *
 * @internal
 */
export const ignoreConfiguredEndpointUrlsConfigSelectors: LoadedConfigSelectors<boolean | undefined> = {
  environmentVariableSelector: (env) => booleanSelector(env, ENV_IGNORE_CONFIGURED_ENDPOINT_URLS, SelectorType.ENV),
  configFileSelector: (profile) =>
    booleanSelector(profile, CONFIG_IGNORE_CONFIGURED_ENDPOINT_URLS, SelectorType.CONFIG),
  default: false,
};
