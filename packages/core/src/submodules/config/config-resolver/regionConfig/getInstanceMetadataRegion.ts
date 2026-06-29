import type { IncomingMessage } from "node:http";

import {
  ENV_IMDS_DISABLED,
  IMDS_REGION_PATH,
  IMDS_TOKEN_PATH,
  X_AWS_EC2_METADATA_TOKEN,
  X_AWS_EC2_METADATA_TOKEN_TTL,
} from "../../defaults-mode/constants";

const TIMEOUT_MS = 1000;
const NEG_CACHE_TTL_MS = 60_000;

let negativeCacheUntil = 0;

interface ImdsEndpoint {
  hostname: string;
  port?: number;
}

/**
 * Returns the region of the host from the EC2 Instance Metadata Service (IMDSv2),
 * or undefined if unavailable.
 *
 * @internal
 */
export const getInstanceMetadataRegion = async (): Promise<string | undefined> => {
  if (process.env[ENV_IMDS_DISABLED]) {
    return undefined;
  }
  if (Date.now() < negativeCacheUntil) {
    return undefined;
  }
  try {
    const endpoint = resolveImdsEndpoint();
    const token = (
      await imdsRequest({
        ...endpoint,
        path: IMDS_TOKEN_PATH,
        method: "PUT",
        headers: {
          [X_AWS_EC2_METADATA_TOKEN_TTL]: "21600",
        },
      })
    ).toString();
    const region = (
      await imdsRequest({
        ...endpoint,
        path: IMDS_REGION_PATH,
        method: "GET",
        headers: {
          [X_AWS_EC2_METADATA_TOKEN]: token,
        },
      })
    )
      .toString()
      .trim();
    return region || cacheNegativeAndReturnUndefined();
  } catch {
    return cacheNegativeAndReturnUndefined();
  }
};

const cacheNegativeAndReturnUndefined = (): undefined => {
  negativeCacheUntil = Date.now() + NEG_CACHE_TTL_MS;
  return undefined;
};

const resolveImdsEndpoint = (): ImdsEndpoint => {
  const envEndpoint = process.env.AWS_EC2_METADATA_SERVICE_ENDPOINT;
  if (envEndpoint) {
    const url = new URL(envEndpoint);
    return {
      hostname: url.hostname.replace(/^\[(.+)]$/, "$1"),
      port: url.port ? Number(url.port) : undefined,
    };
  }
  if (process.env.AWS_EC2_METADATA_SERVICE_ENDPOINT_MODE === "IPv6") {
    return { hostname: "fd00:ec2::254" };
  }
  return { hostname: "169.254.169.254" };
};

interface ImdsRequestOptions {
  hostname: string;
  port?: number;
  path: string;
  method: "GET" | "PUT";
  headers?: Record<string, string>;
}

const imdsRequest = async (options: ImdsRequestOptions): Promise<Buffer> => {
  const { request } = await import("node:http");
  return new Promise<Buffer>((resolve, reject) => {
    const req = request({
      hostname: options.hostname,
      port: options.port,
      path: options.path,
      method: options.method,
      headers: options.headers,
      timeout: TIMEOUT_MS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
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
      if (statusCode < 200 || statusCode >= 300) {
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
