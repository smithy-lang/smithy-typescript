import { Logger } from "@smithy/types";

/**
 * @internal
 */
export const DEFAULT_TIMEOUT = 1000;

/**
 * @internal
 */
export const DEFAULT_MAX_RETRIES = 3;

/**
 * @public
 */
export interface RemoteProviderConfig {
  /**
   * The connection timeout (in milliseconds)
   */
  timeout?: number;

  /**
   * The maximum number of times the HTTP connection should be retried
   */
  maxRetries?: number;
}

/**
 * @public
 */
export interface RemoteProviderInit extends Partial<RemoteProviderConfig> {
  logger?: Logger;
  /**
   * Only used in the IMDS credential provider.
   */
  ec2MetadataV1Disabled?: boolean;
  /**
   * Explicitly specify EC2 instance profile name (IAM role) to use on the EC2 instance.
   */
  ec2InstanceProfileName?: string;
  /**
   * AWS_PROFILE.
   */
  profile?: string;
}
