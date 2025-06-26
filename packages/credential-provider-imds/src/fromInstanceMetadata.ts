import { loadConfig } from "@smithy/node-config-provider";
import { CredentialsProviderError } from "@smithy/property-provider";
import { AwsCredentialIdentity, Logger, Provider } from "@smithy/types";
import { RequestOptions } from "http";

import { InstanceMetadataV1FallbackError } from "./error/InstanceMetadataV1FallbackError";
import { httpRequest } from "./remoteProvider/httpRequest";
import { fromImdsCredentials, ImdsCredentials, isImdsCredentials } from "./remoteProvider/ImdsCredentials";
import { DEFAULT_MAX_RETRIES, DEFAULT_TIMEOUT, RemoteProviderInit } from "./remoteProvider/RemoteProviderInit";
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
 * Creates a credential provider that will source credentials from the EC2
 * Instance Metadata Service
 *
 * @internal
 */
export const fromInstanceMetadata = (init: RemoteProviderInit = {}): Provider<InstanceMetadataCredentials> =>
  staticStabilityProvider(getInstanceMetadataProvider(init), { logger: init.logger });

/**
 * @internal
 */
const getInstanceMetadataProvider = (init: RemoteProviderInit = {}) => {
  const { profile, logger, timeout = DEFAULT_TIMEOUT, maxRetries = DEFAULT_MAX_RETRIES, ec2MetadataV1Disabled } = init;

  // when set to true, metadata service will not fetch token
  let disableFetchToken = false;

  const getCredentials = async (options: RequestOptions) => {
    const isImdsV1Fallback = disableFetchToken || options.headers?.[X_AWS_EC2_METADATA_TOKEN] == null;

    if (isImdsV1Fallback) {
      await throwIfImdsTurnedOff({ profile, logger });
      let fallbackBlockedFromProfile = false;
      let fallbackBlockedFromProcessEnv = false;

      const _ec2MetadataV1Disabled =
        ec2MetadataV1Disabled !== undefined
          ? ec2MetadataV1Disabled
          : await loadConfig(
              {
                environmentVariableSelector: (env) => {
                  const envValue = env[AWS_EC2_METADATA_V1_DISABLED];
                  if (envValue === undefined) {
                    return undefined;
                  }
                  fallbackBlockedFromProcessEnv = !!envValue && envValue !== "false";
                  return fallbackBlockedFromProcessEnv;
                },
                configFileSelector: (profile) => {
                  const profileValue = profile[PROFILE_AWS_EC2_METADATA_V1_DISABLED];
                  if (profileValue === undefined) {
                    return undefined;
                  }
                  fallbackBlockedFromProfile = !!profileValue && profileValue !== "false";
                  return fallbackBlockedFromProfile;
                },
                default: false,
              },
              {
                profile,
              }
            )();

      if (_ec2MetadataV1Disabled) {
        const causes: string[] = [];
        if (ec2MetadataV1Disabled)
          causes.push("credential provider initialization (runtime option ec2MetadataV1Disabled)");
        if (fallbackBlockedFromProfile) {
          causes.push(`config file profile (${PROFILE_AWS_EC2_METADATA_V1_DISABLED})`);
        }
        if (fallbackBlockedFromProcessEnv) {
          causes.push(`process environment variable (${AWS_EC2_METADATA_V1_DISABLED})`);
        }
        throw new InstanceMetadataV1FallbackError(
          `AWS EC2 Metadata v1 fallback has been blocked by AWS SDK configuration in the following: [${causes.join(
            ", "
          )}].`
        );
      }
    }

    const imdsProfile = await getImdsProfile(options, init);

    return retry(async () => {
      let creds: AwsCredentialIdentity;
      try {
        creds = await getCredentialsFromImdsProfile(imdsProfile, options, init);
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
    await throwIfImdsTurnedOff({ profile, logger });
    const endpoint = await getInstanceMetadataEndpoint();
    if (disableFetchToken) {
      logger?.debug("AWS SDK Instance Metadata", "using v1 fallback (no token fetch)");
      return getCredentials({ ...endpoint, timeout });
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
        return getCredentials({ ...endpoint, timeout });
      }
      return getCredentials({
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
export const getImdsProfile = async (options: RequestOptions, init: RemoteProviderInit = {}): Promise<string> => {
  let apiVersion: "unknown" | "extended" | "legacy" = "unknown";
  let resolvedProfile: string | null = null;

  return retry<string>(async () => {
    // First check if a profile name is configured
    const ec2InstanceProfileName = await getEc2InstanceProfileName(init);
    if (ec2InstanceProfileName) {
      return ec2InstanceProfileName;
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
  }, init.maxRetries ?? DEFAULT_MAX_RETRIES);
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
 * Checks if IMDS credential fetching is disabled through configuration
 * @internal
 */
export const throwIfImdsTurnedOff = async ({
  profile,
  logger,
}: {
  profile?: string;
  logger?: Logger;
}): Promise<void> => {
  // Load configuration in priority order
  const disableImds = await loadConfig(
    {
      // Check environment variable
      environmentVariableSelector: (env) => {
        const envValue = env[ENV_IMDS_DISABLED];
        if (envValue === undefined) {
          return undefined;
        }
        return envValue === "true";
      },
      // Check config file
      configFileSelector: (profile) => {
        const profileValue = profile[CONFIG_IMDS_DISABLED];
        if (profileValue === undefined) {
          return undefined;
        }
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
 * Gets configured profile name from various sources
 * @internal
 */
export const getEc2InstanceProfileName = async (init: RemoteProviderInit): Promise<string | undefined> => {
  const ec2InstanceProfileName =
    init.ec2InstanceProfileName ??
    (await loadConfig<string | undefined>(
      {
        environmentVariableSelector: (env) => env[ENV_PROFILE_NAME],
        configFileSelector: (profile) => profile[CONFIG_PROFILE_NAME],
        default: undefined,
      },
      { profile: init.profile }
    )());

  // Validate if name is provided but empty
  if (typeof ec2InstanceProfileName === "string" && ec2InstanceProfileName.trim() === "") {
    throw new CredentialsProviderError("EC2 instance profile name cannot be empty", {
      logger: init?.logger,
    });
  }

  return ec2InstanceProfileName;
};

/**
 * Gets credentials from profile.
 *
 * @param imdsProfile - todo: how is this different from init.profile?
 * @param options
 * @param init
 *
 * @internal
 */
const getCredentialsFromImdsProfile = async (
  imdsProfile: string,
  options: RequestOptions,
  init: RemoteProviderInit
) => {
  // Try extended API first
  try {
    return await getCredentialsFromPath(IMDS_EXTENDED_PATH + imdsProfile, options, init);
  } catch (error) {
    // If extended API returns 404, fall back to legacy API
    if (error.statusCode === 404) {
      try {
        return await getCredentialsFromPath(IMDS_LEGACY_PATH + imdsProfile, options);
      } catch (legacyError) {
        if (legacyError.statusCode === 404 && init.ec2InstanceProfileName === undefined) {
          // If legacy API also returns 404 and we're using a cached profile name,
          // the profile might have changed - clear cache and retry
          const newImdsProfile = await getImdsProfile(options, init);
          return getCredentialsFromImdsProfile(newImdsProfile, options, init);
        }
        throw legacyError;
      }
    }
    throw error;
  }
};

/**
 * Gets credentials from specified IMDS path
 * @internal
 */
async function getCredentialsFromPath(path: string, options: RequestOptions, init: RemoteProviderInit = {}) {
  const response = await httpRequest({
    ...options,
    path,
  });

  let credentialsResponse: ImdsCredentials | unknown;
  try {
    credentialsResponse = JSON.parse(response.toString());
  } catch (error) {
    throw new CredentialsProviderError("Failed to parse JSON from instance metadata service.", { logger: init.logger });
  }

  // Validate response
  if (!isImdsCredentials(credentialsResponse)) {
    throw new CredentialsProviderError("Invalid response received from instance metadata service.", {
      logger: init.logger,
    });
  }

  // Convert IMDS credentials format to standard format
  return fromImdsCredentials(credentialsResponse);
}
