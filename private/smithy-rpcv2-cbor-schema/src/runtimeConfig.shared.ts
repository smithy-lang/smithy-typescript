// smithy-typescript generated code
import { defaultRpcV2ProtocolHttpAuthSchemeProvider } from "./auth/httpAuthSchemeProvider";
import { defaultEndpointResolver } from "./endpoint/endpointResolver";
import { NoAuthSigner } from "@smithy/core";
import { SmithyRpcV2CborProtocol } from "@smithy/core/cbor";
import { NoOpLogger } from "@smithy/smithy-client";
import { IdentityProviderConfig } from "@smithy/types";
import { parseUrl } from "@smithy/url-parser";
import { fromBase64, toBase64 } from "@smithy/util-base64";
import { fromUtf8, toUtf8 } from "@smithy/util-utf8";
import { RpcV2ProtocolClientConfig } from "./RpcV2ProtocolClient";

/**
 * @internal
 */
export const getRuntimeConfig = (config: RpcV2ProtocolClientConfig) => {
  return {
    apiVersion: "2020-07-14",
    base64Decoder: config?.base64Decoder ?? fromBase64,
    base64Encoder: config?.base64Encoder ?? toBase64,
    disableHostPrefix: config?.disableHostPrefix ?? false,
    endpointProvider: config?.endpointProvider ?? defaultEndpointResolver,
    extensions: config?.extensions ?? [],
    httpAuthSchemeProvider: config?.httpAuthSchemeProvider ?? defaultRpcV2ProtocolHttpAuthSchemeProvider,
    httpAuthSchemes: config?.httpAuthSchemes ?? [
      {
        schemeId: "smithy.api#noAuth",
        identityProvider: (ipc: IdentityProviderConfig) =>
          ipc.getIdentityProvider("smithy.api#noAuth") || (async () => ({})),
        signer: new NoAuthSigner(),
      },
    ],
    logger: config?.logger ?? new NoOpLogger(),
    protocol: config?.protocol ?? new SmithyRpcV2CborProtocol({ defaultNamespace: "smithy.protocoltests.rpcv2Cbor" }),
    urlParser: config?.urlParser ?? parseUrl,
    utf8Decoder: config?.utf8Decoder ?? fromUtf8,
    utf8Encoder: config?.utf8Encoder ?? toUtf8,
  };
};
