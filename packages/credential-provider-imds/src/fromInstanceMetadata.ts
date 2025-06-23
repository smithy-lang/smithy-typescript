import { loadConfig } from "@smithy/node-config-provider";
import { CredentialsProviderError } from "@smithy/property-provider";
import { AwsCredentialIdentity, Provider } from "@smithy/types";
import { RequestOptions } from "http";

import { InstanceMetadataV1FallbackError } from "./error/InstanceMetadataV1FallbackError";
import { httpRequest } from "./remoteProvider/httpRequest";
import { fromImdsCredentials, isImdsCredentials } from "./remoteProvider/ImdsCredentials";
import { providerConfigFromInit, RemoteProviderInit } from "./remoteProvider/RemoteProviderInit";
import { retry } from "./remoteProvider/retry";
import { InstanceMetadataCredentials } from "./types";
import { getInstanceMetadataEndpoint } from "./utils/getInstanceMetadataEndpoint";
import { staticStabilityProvider } from "./utils/staticStabilityProvider";

const IMDS_LEGACY_PATH = "/latest/meta-data/iam/security-credentials/";
const IMDS_EXTENDED_PATH = "/latest/meta-data/iam/security-credentials-extended/";
const AWS_EC2_METADATA_V1_DISABLED = "AWS_EC2_METADATA_V1_DISABLED";
const PROFILE_AWS_EC2_METADATA_V1_DISABLED = "ec2_metadata_v1_disabled";
const IMDS_TOKEN_PATH = "/latest/api/token";
const X_AWS_EC2_METADATA_TOKEN = "x-aws-ec2-metadata-token";

// Environment variables and config keys

const ENV_IMDS_DISABLED = "AWS_EC2_METADATA_DISABLED";
const CONFIG_IMDS_DISABLED = "disable_ec2_metadata";
const ENV_PROFILE_NAME = "AWS_EC2_INSTANCE_PROFILE_NAME";
const CONFIG_PROFILE_NAME = "ec2_instance_profile_name";

/**
 * @internal
 *
 * Creates a credential provider that will source credentials from the EC2
 * Instance Metadata Service
 */
export const fromInstanceMetadata = (init: RemoteProviderInit = {}): Provider<InstanceMetadataCredentials> =>
  staticStabilityProvider(getInstanceMetadataProvider(init), { logger: init.logger });

/**
 * @internal
 */
const getInstanceMetadataProvider = (init: RemoteProviderInit = {}) => {
  // when set to true, metadata service will not fetch token
  let disableFetchToken = false;
  const { logger, profile } = init;
  const { timeout, maxRetries } = providerConfigFromInit(init);

  const getCredentials = async (maxRetries: number, options: RequestOptions) => {
    const isImdsV1Fallback = disableFetchToken || options.headers?.[X_AWS_EC2_METADATA_TOKEN] == null;

    if (isImdsV1Fallback) {
      await throwIfImdsTurnedOff(profile, logger);
      let fallbackBlockedFromProfile = false;
      let fallbackBlockedFromProcessEnv = false;

      const configValue = await loadConfig(
        {
          environmentVariableSelector: (env) => {
            const envValue = env[AWS_EC2_METADATA_V1_DISABLED];
            fallbackBlockedFromProcessEnv = !!envValue && envValue !== "false";
            if (envValue === undefined) {
              throw new CredentialsProviderError(
                `${AWS_EC2_METADATA_V1_DISABLED} not set in env, checking config file next.`,
                { logger: init.logger }
              );
            }
            return fallbackBlockedFromProcessEnv;
          },
          configFileSelector: (profile) => {
            const profileValue = profile[PROFILE_AWS_EC2_METADATA_V1_DISABLED];
            fallbackBlockedFromProfile = !!profileValue && profileValue !== "false";
            return fallbackBlockedFromProfile;
          },
          default: false,
        },
        {
          profile,
        }
      )();

      if (init.ec2MetadataV1Disabled || configValue) {
        const causes: string[] = [];
        if (init.ec2MetadataV1Disabled)
          causes.push("credential provider initialization (runtime option ec2MetadataV1Disabled)");
        if (fallbackBlockedFromProfile) causes.push(`config file profile (${PROFILE_AWS_EC2_METADATA_V1_DISABLED})`);
        if (fallbackBlockedFromProcessEnv)
          causes.push(`process environment variable (${AWS_EC2_METADATA_V1_DISABLED})`);

        throw new InstanceMetadataV1FallbackError(
          `AWS EC2 Metadata v1 fallback has been blocked by AWS SDK configuration in the following: [${causes.join(
            ", "
          )}].`
        );
      }
    }

    const imdsProfile = await getImdsProfile(options, maxRetries, init, profile);

    return retry(async () => {
      let creds: AwsCredentialIdentity;
      try {
        creds = await getCredentialsFromProfile(imdsProfile, options, init);
      } catch (err) {
        if (err.statusCode === 401) {
          disableFetchToken = false;
        }
        throw err;
      }
      return creds;
    }, maxRetries);
  };

  return async () => {
    const endpoint = await getInstanceMetadataEndpoint();
    await throwIfImdsTurnedOff(profile, logger);
    if (disableFetchToken) {
      logger?.debug("AWS SDK Instance Metadata", "using v1 fallback (no token fetch)");
      return getCredentials(maxRetries, { ...endpoint, timeout });
    } else {
      let token: string;
      try {
        token = (await getMetadataToken({ ...endpoint, timeout })).toString();
      } catch (error) {
        if (error?.statusCode === 400) {
          throw Object.assign(error, {
            message: "EC2 Metadata token request returned error",
          });
        } else if (error.message === "TimeoutError" || [403, 404, 405].includes(error.statusCode)) {
          disableFetchToken = true;
        }
        logger?.debug("AWS SDK Instance Metadata", "using v1 fallback (initial)");
        return getCredentials(maxRetries, { ...endpoint, timeout });
      }
      return getCredentials(maxRetries, {
        ...endpoint,
        headers: {
          [X_AWS_EC2_METADATA_TOKEN]: token,
        },
        timeout,
      });
    }
  };
};

/**
 * @internal
 * Gets IMDS profile with proper error handling and retries
 */
export const getImdsProfile = async (
  options: RequestOptions,
  maxRetries: number,
  init: RemoteProviderInit = {},
  profile?: string,
  resetCache?: boolean
): Promise<string> => {
  let apiVersion: "unknown" | "extended" | "legacy" = "unknown";
  let resolvedProfile: string | null = null;

  // If resetCache is true, clear the cached profile name
  if (resetCache) {
    resolvedProfile = null;
  }

  return retry<string>(async () => {
    // First check if a profile name is configured
    const configuredName = await getConfiguredProfileName(init, profile);
    if (configuredName) {
      return configuredName;
    }
    if (resolvedProfile) {
      return resolvedProfile;
    }
    // Try extended API first
    try {
      const response = await httpRequest({ ...options, path: IMDS_EXTENDED_PATH });
      resolvedProfile = response.toString().trim();
      if (apiVersion === "unknown") {
        apiVersion = "extended";
      }
      return resolvedProfile;
    } catch (error) {
      if (error?.statusCode === 404 && apiVersion === "unknown") {
        apiVersion = "legacy";
        const response = await httpRequest({ ...options, path: IMDS_LEGACY_PATH });
        resolvedProfile = response.toString().trim();
        return resolvedProfile;
      } else {
        throw error;
      }
    }
  }, maxRetries);
};

export const getMetadataToken = async (options: RequestOptions) =>
  httpRequest({
    ...options,
    path: IMDS_TOKEN_PATH,
    method: "PUT",
    headers: {
      "x-aws-ec2-metadata-token-ttl-seconds": "21600",
    },
  });

/**
 * @internal
 * Checks if IMDS credential fetching is disabled through configuration
 */
export const throwIfImdsTurnedOff = async (profile?: string, logger?: any): Promise<void> => {
  // Load configuration in priority order
  const disableImds = await loadConfig(
    {
      // Check environment variable
      environmentVariableSelector: (env) => {
        const envValue = env[ENV_IMDS_DISABLED];
        return envValue === "true";
      },
      // Check config file
      configFileSelector: (profile) => {
        const profileValue = profile[CONFIG_IMDS_DISABLED];
        return profileValue === "true";
      },
      default: false,
    },
    { profile }
  )();

  // If IMDS is disabled, throw error
  if (disableImds) {
    throw new CredentialsProviderError("IMDS credential fetching is disabled", { logger });
  }
};

/**
 * @internal
 * Gets configured profile name from various sources
 */
export const getConfiguredProfileName = async (init: RemoteProviderInit, profile?: string): Promise<string | null> => {
  // Load configuration in priority order
  const profileName = await loadConfig(
    {
      // Check environment variable
      environmentVariableSelector: (env) => env[ENV_PROFILE_NAME],
      // Check config file
      configFileSelector: (profile) => profile[CONFIG_PROFILE_NAME],
      default: null,
    },
    { profile }
  )();

  // Check runtime config (highest priority)
  const name = init.ec2InstanceProfileName ?? profileName;

  // Validate if name is provided but empty
  if (typeof name === "string" && name.trim() === "") {
    throw new CredentialsProviderError("EC2 instance profile name cannot be empty");
  }

  return name;
};

/**
 * @internal
 * Gets credentials from profile
 */
const getCredentialsFromProfile = async (profile: string, options: RequestOptions, init: RemoteProviderInit) => {
  // Try extended API first
  try {
    return await getCredentialsFromPath(IMDS_EXTENDED_PATH + profile, options);
  } catch (error) {
    // If extended API returns 404, fall back to legacy API
    if (error.statusCode === 404) {
      try {
        return await getCredentialsFromPath(IMDS_LEGACY_PATH + profile, options);
      } catch (legacyError) {
        if (legacyError.statusCode === 404 && init.ec2InstanceProfileName === undefined) {
          // If legacy API also returns 404 and we're using a cached profile name,
          // the profile might have changed - clear cache and retry
          const newProfileName = await getImdsProfile(options, init.maxRetries ?? 3, init, profile, true);
          return getCredentialsFromProfile(newProfileName, options, init);
        }
        throw legacyError;
      }
    }
    throw error;
  }
};

/**
 * @internal
 * Gets credentials from specified IMDS path
 */
async function getCredentialsFromPath(path: string, options: RequestOptions) {
  const response = await httpRequest({
    ...options,
    path,
  });

  const credentialsResponse = JSON.parse(response.toString());

  // Validate response
  if (!isImdsCredentials(credentialsResponse)) {
    throw new CredentialsProviderError("Invalid response received from instance metadata service.");
  }

  // Convert IMDS credentials format to standard format
  return fromImdsCredentials(credentialsResponse);
}
