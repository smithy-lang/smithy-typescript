// smithy-typescript generated code
import { HttpApiKeyAuthSigner } from "@smithy/core";
import { SmithyRpcV2CborProtocol } from "@smithy/core/cbor";
import { NoOpLogger } from "@smithy/smithy-client";
import type { IdentityProviderConfig } from "@smithy/types";
import { parseUrl } from "@smithy/url-parser";
import { fromBase64, toBase64 } from "@smithy/util-base64";
import { fromUtf8, toUtf8 } from "@smithy/util-utf8";

import { defaultXYZServiceHttpAuthSchemeProvider } from "./auth/httpAuthSchemeProvider";
import { defaultEndpointResolver } from "./endpoint/endpointResolver";
import { errorTypeRegistries } from "./schemas/schemas_0";
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
    protocol: config?.protocol ?? SmithyRpcV2CborProtocol,
    protocolSettings: config?.protocolSettings ?? {
      defaultNamespace: "org.xyz.v1",
      errorTypeRegistries,
    },
    urlParser: config?.urlParser ?? parseUrl,
    utf8Decoder: config?.utf8Decoder ?? fromUtf8,
    utf8Encoder: config?.utf8Encoder ?? toUtf8,
  };
};
