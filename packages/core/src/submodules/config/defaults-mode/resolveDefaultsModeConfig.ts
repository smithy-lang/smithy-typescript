import type { DefaultsMode, ResolvedDefaultsMode } from "@smithy/core/client";
import type { Provider } from "@smithy/types";
import type { IncomingMessage } from "node:http";

import { NODE_REGION_CONFIG_OPTIONS } from "../config-resolver/regionConfig/config";
import { loadConfig } from "../node-config-provider/configLoader";
import { memoize } from "../property-provider/memoize";
import {
  AWS_DEFAULT_REGION_ENV,
  AWS_EXECUTION_ENV,
  AWS_REGION_ENV,
  DEFAULTS_MODE_OPTIONS,
  ENV_IMDS_DISABLED,
  IMDS_REGION_PATH,
} from "./constants";
import { NODE_DEFAULTS_MODE_CONFIG_OPTIONS } from "./defaultsModeConfig";

/**
 * @internal
 */
export interface ResolveDefaultsModeConfigOptions {
  defaultsMode?: DefaultsMode | Provider<DefaultsMode>;
  region?: string | Provider<string>;
}

/**
 * Validate the defaultsMode configuration. If the value is set to "auto", it
 * resolves the value to "in-region", "cross-region", or "standard".
 *
 * @default "legacy"
 * @internal
 */
export const resolveDefaultsModeConfig = ({
  region = loadConfig(NODE_REGION_CONFIG_OPTIONS),
  defaultsMode = loadConfig(NODE_DEFAULTS_MODE_CONFIG_OPTIONS),
}: ResolveDefaultsModeConfigOptions = {}): Provider<ResolvedDefaultsMode> =>
  memoize(async () => {
    const mode = typeof defaultsMode === "function" ? await defaultsMode() : defaultsMode;
    switch (mode?.toLowerCase()) {
      case "auto":
        return resolveNodeDefaultsModeAuto(region);
      case "in-region":
      case "cross-region":
      case "mobile":
      case "standard":
      case "legacy":
        return Promise.resolve(mode?.toLocaleLowerCase() as ResolvedDefaultsMode);
      case undefined:
        return Promise.resolve("legacy");
      default:
        throw new Error(
          `Invalid parameter for "defaultsMode", expect ${DEFAULTS_MODE_OPTIONS.join(", ")}, got ${mode}`
        );
    }
  });

const resolveNodeDefaultsModeAuto = async (clientRegion?: string | Provider<string>): Promise<ResolvedDefaultsMode> => {
  if (clientRegion) {
    const resolvedRegion = typeof clientRegion === "function" ? await clientRegion() : clientRegion;
    const inferredRegion = await inferPhysicalRegion();
    if (!inferredRegion) {
      return "standard";
    }
    if (resolvedRegion === inferredRegion) {
      return "in-region";
    } else {
      return "cross-region";
    }
  }
  return "standard";
};

/**
 * Infer the hosting app's physical region.
 */
const inferPhysicalRegion = async (): Promise<string | undefined> => {
  if (process.env[AWS_EXECUTION_ENV] && (process.env[AWS_REGION_ENV] || process.env[AWS_DEFAULT_REGION_ENV])) {
    // We're running in an AWS service environment, so we can trust the region environment variables to be the current
    // region, if they're set
    return process.env[AWS_REGION_ENV] ?? process.env[AWS_DEFAULT_REGION_ENV];
  }
  if (!process.env[ENV_IMDS_DISABLED]) {
    // We couldn't figure out the region from environment variables. Check IMDSv2
    try {
      const endpoint = await getImdsEndpoint();
      return (await imdsHttpGet({ hostname: endpoint.hostname, path: IMDS_REGION_PATH })).toString();
    } catch (e) {
      // Swallow the error.
    }
  }
};

/**
 * Inlined from @smithy/credential-provider-imds to avoid circular dependency.
 */
const getImdsEndpoint = async (): Promise<{ hostname: string; path: string }> => {
  const envEndpoint = process.env.AWS_EC2_METADATA_SERVICE_ENDPOINT;
  if (envEndpoint) {
    const url = new URL(envEndpoint);
    return { hostname: url.hostname, path: url.pathname };
  }
  const envMode = process.env.AWS_EC2_METADATA_SERVICE_ENDPOINT_MODE;
  if (envMode === "IPv6") {
    return { hostname: "fd00:ec2::254", path: "/" };
  }
  return { hostname: "169.254.169.254", path: "/" };
};

const imdsHttpGet = async ({ hostname, path }: { hostname: string; path: string }): Promise<Buffer> => {
  const { request } = await import("node:http");
  return new Promise((resolve, reject) => {
    const req = request({
      method: "GET",
      hostname: hostname.replace(/^\[(.+)]$/, "$1"),
      path,
      timeout: 1000,
      signal: AbortSignal.timeout(1000),
    });
    req.on("error", (err: Error) => {
      reject(err);
      req.destroy();
    });
    req.on("timeout", () => {
      reject(new Error("TimeoutError from instance metadata service"));
      req.destroy();
    });
    req.on("response", (res: IncomingMessage) => {
      const { statusCode = 400 } = res;
      if (statusCode < 200 || 300 <= statusCode) {
        reject(Object.assign(new Error("Error response received from instance metadata service"), { statusCode }));
        req.destroy();
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        resolve(Buffer.concat(chunks));
        req.destroy();
      });
    });
    req.end();
  });
};
