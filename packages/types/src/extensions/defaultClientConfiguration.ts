import {ChecksumAlgorithm, getChecksumClientConfiguration, resolveChecksumRuntimeConfig} from "./checksum";

/**
 * @internal
 *
 * Default client configuration consisting various configurations for modifying a service client
 */
export interface DefaultClientConfiguration {
    addChecksumAlgorithm(algo: ChecksumAlgorithm): void;
    checksumAlgorithms(): ChecksumAlgorithm[];

    // TODO: add retries, identity, auth, etc
}

/**
 * @internal
 *
 * Helper function to resolve default client configuration from runtime config
 */
export const getDefaultClientConfiguration = (runtimeConfig: any) => {
    const defaultClientConfiguration: DefaultClientConfiguration = {
        ...getChecksumClientConfiguration(runtimeConfig)
    };
    return defaultClientConfiguration;
}

/**
 * @internal
 *
 * Helper function to resolve runtime config from default client configuration
 */
export const resolveDefaultRuntimeConfig = (clientConfig: DefaultClientConfiguration) => {
    const runtimeConfig: any = {
        ...resolveChecksumRuntimeConfig(clientConfig)
    };
    return runtimeConfig;
}