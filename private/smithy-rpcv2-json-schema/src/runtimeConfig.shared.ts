// smithy-typescript generated code
import { NoAuthSigner } from "@smithy/core";
import { Sha256 } from "@smithy/core/checksum";
import { NoOpLogger } from "@smithy/core/client";
import { parseUrl, SmithyRpcV2JsonProtocol } from "@smithy/core/protocols";
import { fromBase64, fromUtf8, toBase64, toUtf8 } from "@smithy/core/serde";
import type { IdentityProviderConfig } from "@smithy/types";

import { defaultRpcV2JsonProtocolHttpAuthSchemeProvider } from "./auth/httpAuthSchemeProvider";
import { defaultEndpointResolver } from "./endpoint/endpointResolver";
import type { RpcV2JsonProtocolClientConfig } from "./RpcV2JsonProtocolClient";
import { errorTypeRegistries } from "./schemas/schemas_0";

/**
 * @internal
 */
export const getRuntimeConfig = (config: RpcV2JsonProtocolClientConfig) => {
  return {
    apiVersion: "2020-07-14",
    base64Decoder: config?.base64Decoder ?? fromBase64,
    base64Encoder: config?.base64Encoder ?? toBase64,
    disableHostPrefix: config?.disableHostPrefix ?? false,
    endpointProvider: config?.endpointProvider ?? defaultEndpointResolver,
    extensions: config?.extensions ?? [],
    httpAuthSchemeProvider: config?.httpAuthSchemeProvider ?? defaultRpcV2JsonProtocolHttpAuthSchemeProvider,
    httpAuthSchemes: config?.httpAuthSchemes ?? [
      {
        schemeId: "smithy.api#noAuth",
        identityProvider: (ipc: IdentityProviderConfig) =>
          ipc.getIdentityProvider("smithy.api#noAuth") || (async () => ({})),
        signer: new NoAuthSigner(),
      },
    ],
    logger: config?.logger ?? new NoOpLogger(),
    protocol: config?.protocol ?? SmithyRpcV2JsonProtocol,
    protocolSettings: config?.protocolSettings ?? {
      defaultNamespace: "smithy.protocoltests.rpcv2Json",
      errorTypeRegistries,
    },
    sha256: config?.sha256 ?? Sha256,
    urlParser: config?.urlParser ?? parseUrl,
    utf8Decoder: config?.utf8Decoder ?? fromUtf8,
    utf8Encoder: config?.utf8Encoder ?? toUtf8,
  };
};
