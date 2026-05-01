// smithy-typescript generated code
import { HttpApiKeyAuthSigner } from "@smithy/core";
import { NoOpLogger } from "@smithy/core/client";
import { fromBase64, fromUtf8, toBase64, toUtf8 } from "@smithy/core/serde";
import type { IdentityProviderConfig } from "@smithy/types";
import { parseUrl } from "@smithy/url-parser";

import { defaultXYZServiceHttpAuthSchemeProvider } from "./auth/httpAuthSchemeProvider";
import { defaultEndpointResolver } from "./endpoint/endpointResolver";
import type { XYZServiceClientConfig } from "./XYZServiceClient";

/**
 * @internal
 */
export const getRuntimeConfig = (config: XYZServiceClientConfig) => {
  return {
    apiVersion: "1.0",
    base64Decoder: config?.base64Decoder ?? fromBase64,
    base64Encoder: config?.base64Encoder ?? toBase64,
    disableHostPrefix: config?.disableHostPrefix ?? false,
    endpointProvider: config?.endpointProvider ?? defaultEndpointResolver,
    extensions: config?.extensions ?? [],
    httpAuthSchemeProvider: config?.httpAuthSchemeProvider ?? defaultXYZServiceHttpAuthSchemeProvider,
    httpAuthSchemes: config?.httpAuthSchemes ?? [
      {
        schemeId: "smithy.api#httpApiKeyAuth",
        identityProvider: (ipc: IdentityProviderConfig) =>
          ipc.getIdentityProvider("smithy.api#httpApiKeyAuth"),
        signer: new HttpApiKeyAuthSigner(),
      },
    ],
    logger: config?.logger ?? new NoOpLogger(),
    urlParser: config?.urlParser ?? parseUrl,
    utf8Decoder: config?.utf8Decoder ?? fromUtf8,
    utf8Encoder: config?.utf8Encoder ?? toUtf8,
  };
};
