import type { AwsCredentialIdentity, ChecksumConstructor, HashConstructor, SourceData } from "@smithy/types";
import { toHex } from "@smithy/util-hex-encoding";
import { toUint8Array } from "@smithy/util-utf8";

import { KEY_TYPE_IDENTIFIER, MAX_CACHE_SIZE } from "./constants";

const signingKeyCache: Record<string, Uint8Array> = {};
const cacheQueue: Array<string> = [];

/**
 * Create a string describing the scope of credentials used to sign a request.
 *
 * @internal
 *
 * @param shortDate - the current calendar date in the form YYYYMMDD.
 * @param region    - the AWS region in which the service resides.
 * @param service   - the service to which the signed request is being sent.
 */
export const createScope = (shortDate: string, region: string, service: string): string =>
  `${shortDate}/${region}/${service}/${KEY_TYPE_IDENTIFIER}`;

/**
 * Derive a signing key from its composite parts.
 *
 * @internal
 *
 * @param sha256Constructor - a constructor function that can instantiate SHA-256
 *                          hash objects.
 * @param credentials       - the credentials with which the request will be
 *                          signed.
 * @param shortDate         - the current calendar date in the form YYYYMMDD.
 * @param region            - the AWS region in which the service resides.
 * @param service           - the service to which the signed request is being
 *                          sent.
 */
export const getSigningKey = async (
  sha256Constructor: ChecksumConstructor | HashConstructor,
  credentials: AwsCredentialIdentity,
  shortDate: string,
  region: string,
  service: string
): Promise<Uint8Array> => {
  const credsHash = await hmac(sha256Constructor, credentials.secretAccessKey, credentials.accessKeyId);
  const cacheKey = `${shortDate}:${region}:${service}:${toHex(credsHash)}:${credentials.sessionToken}`;
  if (cacheKey in signingKeyCache) {
    return signingKeyCache[cacheKey];
  }

  cacheQueue.push(cacheKey);
  while (cacheQueue.length > MAX_CACHE_SIZE) {
    delete signingKeyCache[cacheQueue.shift() as string];
  }

  let key: SourceData = `AWS4${credentials.secretAccessKey}`;
  for (const signable of [shortDate, region, service, KEY_TYPE_IDENTIFIER]) {
    key = await hmac(sha256Constructor, key, signable);
  }
  return (signingKeyCache[cacheKey] = key as Uint8Array);
};

/**
 * @internal
 */
export const clearCredentialCache = (): void => {
  cacheQueue.length = 0;
  Object.keys(signingKeyCache).forEach((cacheKey) => {
    delete signingKeyCache[cacheKey];
  });
};

const hmac = (
  ctor: ChecksumConstructor | HashConstructor,
  secret: SourceData,
  data: SourceData
): Promise<Uint8Array> => {
  const hash = new ctor(secret);
  hash.update(toUint8Array(data));
  return hash.digest();
};
