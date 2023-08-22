import { ChecksumConfiguration } from "./checksum";

/**
 * @internal
 *
 * Default extension configuration consisting various configurations for modifying a service client
 */
export interface DefaultExtensionConfiguration extends ChecksumConfiguration {}

type GetDefaultConfigurationType = (runtimeConfig: any) => DefaultExtensionConfiguration;
