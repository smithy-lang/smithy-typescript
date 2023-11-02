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

const IMDS_PATH = "/latest/meta-data/iam/security-credentials/";
const IMDS_TOKEN_PATH = "/latest/api/token";
const AWS_EC2_METADATA_V1_DISABLED = "AWS_EC2_METADATA_V1_DISABLED";
const PROFILE_AWS_EC2_METADATA_V1_DISABLED = "ec2_metadata_v1_disabled";
const X_AWS_EC2_METADATA_TOKEN = "x-aws-ec2-metadata-token";

/**
 * @internal
 *
 * Creates a credential provider that will source credentials from the EC2
 * Instance Metadata Service
 */
export const fromInstanceMetadata = (init: RemoteProviderInit = {}): Provider<InstanceMetadataCredentials> =>
  staticStabilityProvider(getInstanceImdsProvider(init), { logger: init.logger });

const getInstanceImdsProvider = (init: RemoteProviderInit) => {
  // when set to true, metadata service will not fetch token
  let disableFetchToken = false;
  const { logger, profile } = init;
  const { timeout, maxRetries } = providerConfigFromInit(init);

  const getCredentials = async (maxRetries: number, options: RequestOptions) => {
    const isImdsV1Fallback = disableFetchToken || options.headers?.[X_AWS_EC2_METADATA_TOKEN] == null;

    if (isImdsV1Fallback) {
      let fallbackBlockedFromProfile = false;
      let fallbackBlockedFromProcessEnv = false;

      const configValue = await loadConfig(
        {
          environmentVariableSelector: (env) => {
            const envValue = env[AWS_EC2_METADATA_V1_DISABLED];
            fallbackBlockedFromProcessEnv = !!envValue && envValue !== "false";
            if (envValue === undefined) {
              throw new CredentialsProviderError(
                `${AWS_EC2_METADATA_V1_DISABLED} not set in env, checking config file next.`
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

    const imdsProfile = (
      await retry<string>(async () => {
        let profile: string;
        try {
          profile = await getProfile(options);
        } catch (err) {
          if (err.statusCode === 401) {
            disableFetchToken = false;
          }
          throw err;
        }
        return profile;
      }, maxRetries)
    ).trim();

    return retry(async () => {
      let creds: AwsCredentialIdentity;
      try {
        creds = await getCredentialsFromProfile(imdsProfile, options);
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

const getMetadataToken = async (options: RequestOptions) =>
  httpRequest({
    ...options,
    path: IMDS_TOKEN_PATH,
    method: "PUT",
    headers: {
      "x-aws-ec2-metadata-token-ttl-seconds": "21600",
    },
  });

const getProfile = async (options: RequestOptions) => (await httpRequest({ ...options, path: IMDS_PATH })).toString();

const getCredentialsFromProfile = async (profile: string, options: RequestOptions) => {
  const credsResponse = JSON.parse(
    (
      await httpRequest({
        ...options,
        path: IMDS_PATH + profile,
      })
    ).toString()
  );

  if (!isImdsCredentials(credsResponse)) {
    throw new CredentialsProviderError("Invalid response received from instance metadata service.");
  }

  return fromImdsCredentials(credsResponse);
};
