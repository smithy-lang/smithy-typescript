import { JavaHashMap } from "../util";

const KNOWN_CONFIG_KEYS = new Set<string>([
  "profile",
  "apiKey",
  "region",
  "credentials",
  "endpoint",
  "cacheMiddleware",
  "requestHandler",
  "retryStrategy",
  "retryMode",
  "maxAttempts",
  "logger",
  "signer",
  "useDualstackEndpoint",
  "useFipsEndpoint",
  "customUserAgent",
  "extensions",
  "tls",
  "disableHostPrefix",
  "signingRegion",
  "sigv4aSigningRegionSet",
  "authSchemePreference",
  "userAgentAppId",
  "protocol",
  "apiVersion",
  "serviceId",
  "runtime",
  "systemClockOffset",
  "signerConstructor",
  "endpointProvider",
  "urlParser",
  "base64Decoder",
  "base64Encoder",
  "defaultsMode",
  "bodyLengthChecker",
  "credentialDefaultProvider",
  "defaultUserAgentProvider",
  "eventStreamSerdeProvider",
  "getAwsChunkedEncodingStream",
  "md5",
  "sdkStreamMixin",
  "sha1",
  "sha256",
  "streamCollector",
  "streamHasher",
  "utf8Decoder",
  "utf8Encoder",
  "httpAuthSchemes",
  "httpAuthSchemeProvider",
  "serviceConfiguredEndpoint",
]);

/**
 * Client config keys that endpoint parameters must not redefine.
 */
export class ClientConfigKeys {
  private constructor() {}

  public static isKnownConfigKey(key: string): boolean {
    return KNOWN_CONFIG_KEYS.has(key);
  }

  public static getCustomContextParams(
    clientContextParams: JavaHashMap<string>,
    builtInParams: JavaHashMap<string>
  ): JavaHashMap<string> {
    const customContextParams = new JavaHashMap<string>();
    for (const [key, value] of clientContextParams.entries()) {
      if (!builtInParams.has(key) && !KNOWN_CONFIG_KEYS.has(key)) {
        customContextParams.set(key, value);
      }
    }
    return customContextParams;
  }
}
