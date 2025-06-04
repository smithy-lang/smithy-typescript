import { Logger } from "@smithy/types";

/**
 * @internal
 */
export const DEFAULT_TIMEOUT = 1000;

// The default in AWS SDK for Python and CLI (botocore) is no retry or one attempt
// https://github.com/boto/botocore/blob/646c61a7065933e75bab545b785e6098bc94c081/botocore/utils.py#L273
/**
 * @internal
 */
export const DEFAULT_MAX_RETRIES = 0;

/**
 * @public
 */
export interface RemoteProviderConfig {
  /**
   * The connection timeout (in milliseconds)
   */
  timeout: number;

  /**
   * @deprecated The configuration maxRetries was changed to maxAttempts in middleware-retry to be compliant with other SDKs and retry strategy [#1244](https://github.com/aws/aws-sdk-js-v3/pull/1244). Use maxAttempts instead.
   * The maximum number of times the HTTP connection should be retried
   */
  maxRetries?: number;

  /**
   * The maximum number of times the HTTP connection should be retried
   */
  maxAttempts?: number;
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
   * AWS_PROFILE.
   */
  profile?: string;
}

/**
 * @internal
 */
export const providerConfigFromInit = ({
  maxRetries = DEFAULT_MAX_RETRIES,
  maxAttempts,
  timeout = DEFAULT_TIMEOUT,
}: RemoteProviderInit): RemoteProviderConfig => {
  const effectiveMaxAttempts = maxAttempts || maxRetries;

  return { 
    maxRetries: effectiveMaxAttempts, 
    maxAttempts: effectiveMaxAttempts,
    timeout
  };
}
