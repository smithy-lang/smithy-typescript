import { ProviderError } from "@smithy/core/config";
import type { Provider } from "@smithy/types";

import { httpRequest } from "./remoteProvider/httpRequest";
import { retry } from "./remoteProvider/retry";
import { getInstanceMetadataEndpoint } from "./utils/getInstanceMetadataEndpoint";

const IMDS_REGION_PATH = "/latest/meta-data/placement/region";
const IMDS_TOKEN_PATH = "/latest/api/token";
const X_AWS_EC2_METADATA_TOKEN = "x-aws-ec2-metadata-token";
const X_AWS_EC2_METADATA_TOKEN_TTL = "x-aws-ec2-metadata-token-ttl-seconds";
const ENV_IMDS_DISABLED = "AWS_EC2_METADATA_DISABLED";
const DEFAULT_TIMEOUT_MS = 1000;
const DEFAULT_TOKEN_TTL_SECONDS = "21600";
const NEG_CACHE_TTL_MS = 60_000;

// Module-level so the negative result is shared across all provider invocations in a process.
let negativeCacheUntil = 0;

/**
 * @public
 */
export interface InstanceMetadataRegionInit {
  /**
   * The connection timeout (in milliseconds).
   */
  timeout?: number;
  /**
   * The maximum number of times the HTTP connection should be retried.
   */
  maxRetries?: number;
}

/**
 * Creates a region provider that sources the region from the EC2 Instance Metadata Service.
 *
 * @public
 */
export const fromInstanceMetadataRegion =
  (init: InstanceMetadataRegionInit = {}): Provider<string> =>
  async (): Promise<string> => {
    if (process.env[ENV_IMDS_DISABLED]) {
      throw new ProviderError("IMDS region provider disabled via AWS_EC2_METADATA_DISABLED", {
        tryNextLink: true,
      });
    }
    if (Date.now() < negativeCacheUntil) {
      throw new ProviderError("IMDS region recently failed; skipping until cache expires", {
        tryNextLink: true,
      });
    }

    const timeout = init.timeout ?? DEFAULT_TIMEOUT_MS;
    const maxRetries = init.maxRetries ?? 0;

    try {
      const endpoint = await getInstanceMetadataEndpoint();
      const token = (
        await retry(
          () =>
            httpRequest({
              ...endpoint,
              path: IMDS_TOKEN_PATH,
              method: "PUT",
              headers: {
                [X_AWS_EC2_METADATA_TOKEN_TTL]: DEFAULT_TOKEN_TTL_SECONDS,
              },
              timeout,
            }),
          maxRetries
        )
      ).toString();

      const region = (
        await retry(
          () =>
            httpRequest({
              ...endpoint,
              path: IMDS_REGION_PATH,
              method: "GET",
              headers: {
                [X_AWS_EC2_METADATA_TOKEN]: token,
              },
              timeout,
            }),
          maxRetries
        )
      )
        .toString()
        .trim();

      if (!region) {
        throw new ProviderError("Empty region response from IMDS", { tryNextLink: true });
      }
      return region;
    } catch (e) {
      negativeCacheUntil = Date.now() + NEG_CACHE_TTL_MS;
      if (e instanceof ProviderError) {
        throw e;
      }
      throw new ProviderError((e as Error)?.message ?? "Unknown IMDS region error", {
        tryNextLink: true,
      });
    }
  };
