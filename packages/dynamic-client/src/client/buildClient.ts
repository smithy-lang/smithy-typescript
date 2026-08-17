import {
  DefaultIdentityProviderConfig,
  getHttpAuthSchemePlugin,
  getHttpSigningPlugin,
  NoAuthSigner,
} from "@smithy/core";
import { Client, NoOpLogger } from "@smithy/core/client";
import { getEndpointPlugin, resolveEndpointConfig } from "@smithy/core/endpoints";
import { getContentLengthPlugin, parseUrl } from "@smithy/core/protocols";
import { getRetryPlugin, resolveRetryConfig } from "@smithy/core/retry";
import { getSchemaSerdePlugin } from "@smithy/core/schema";
import { fromBase64, fromUtf8, toBase64, toUtf8 } from "@smithy/core/serde";
import { getRuntimeTypecheckPlugin, type RuntimeTypecheckOptions } from "@smithy/typecheck";
import type { IdentityProviderConfig } from "@smithy/types";

import { authSchemeParametersProvider, authSchemeProvider } from "../auth/authSchemeProvider";
import type { EndpointProvider } from "../endpoint/buildEndpointProvider";
import type { ClientProtocolCtor } from "../protocol/types";
import type { ProtocolSettings } from "../protocol/selectProtocol";

/**
 * Inputs required to build the dynamic client class.
 *
 * @internal
 */
export interface ClientBuildInputs {
  protocol: ClientProtocolCtor;
  protocolSettings: ProtocolSettings;
  endpointProvider: EndpointProvider;
  /**
   * Runtime typecheck (RTTC) behavior. Because the dynamic client emits no
   * static types, RTTC is installed to validate request inputs and response
   * outputs against the schemas at runtime.
   */
  typecheck: RuntimeTypecheckOptions;
}

/**
 * Builds a `Client` subclass wired with the generic, model-independent
 * middleware stack: schema (de)serialization, retry, content-length, endpoint
 * resolution, and HTTP auth/signing (NoAuth by default).
 *
 * The base `Client` instantiates the protocol constructor from
 * `protocolSettings`, so the subclass only assembles configuration and plugins.
 *
 * @param inputs - the protocol, its settings, and the endpoint provider.
 *
 * @returns a `Client` subclass constructor.
 *
 * @internal
 */
export function buildClient(
  inputs: ClientBuildInputs
): new (config?: Record<string, any>) => Client<any, any, any, any> {
  const { protocol, protocolSettings, endpointProvider, typecheck } = inputs;

  return class DynamicClient extends Client<any, any, any, any> {
    public readonly config: Record<string, any>;

    public constructor(config: Record<string, any> = {}) {
      const resolved = resolveConfig(config, protocol, protocolSettings, endpointProvider);
      super(resolved);
      this.config = resolved;
      const cfg = this.config as any;
      this.middlewareStack.use(getSchemaSerdePlugin(cfg));
      this.middlewareStack.use(getRetryPlugin(cfg));
      this.middlewareStack.use(getContentLengthPlugin(cfg));
      this.middlewareStack.use(getEndpointPlugin(cfg, {} as never));
      this.middlewareStack.use(
        getHttpAuthSchemePlugin(cfg, {
          httpAuthSchemeParametersProvider: authSchemeParametersProvider,
          identityProviderConfigProvider: async () => new DefaultIdentityProviderConfig({}),
        })
      );
      this.middlewareStack.use(getHttpSigningPlugin(cfg));
      // The dynamic client emits no static types, so runtime typechecking
      // validates inputs/outputs against the schemas instead.
      this.middlewareStack.use(getRuntimeTypecheckPlugin({ logger: cfg.logger, ...typecheck }));
    }
  };
}

/**
 * Applies runtime-config defaults and resolves the retry and endpoint config
 * layers. Values already present on the caller's config are preserved.
 *
 * @internal
 */
function resolveConfig(
  config: Record<string, any>,
  protocol: ClientProtocolCtor,
  protocolSettings: ProtocolSettings,
  endpointProvider: EndpointProvider
): Record<string, any> {
  const withDefaults = {
    ...config,
    apiVersion: config.apiVersion ?? "1.0",
    base64Decoder: config.base64Decoder ?? fromBase64,
    base64Encoder: config.base64Encoder ?? toBase64,
    utf8Decoder: config.utf8Decoder ?? fromUtf8,
    utf8Encoder: config.utf8Encoder ?? toUtf8,
    urlParser: config.urlParser ?? parseUrl,
    disableHostPrefix: config.disableHostPrefix ?? false,
    logger: config.logger ?? new NoOpLogger(),
    endpointProvider: config.endpointProvider ?? endpointProvider,
    protocol: config.protocol ?? protocol,
    protocolSettings: config.protocolSettings ?? protocolSettings,
    httpAuthSchemeProvider: config.httpAuthSchemeProvider ?? authSchemeProvider,
    httpAuthSchemes: config.httpAuthSchemes ?? [
      {
        schemeId: "smithy.api#noAuth",
        identityProvider: (ipc: IdentityProviderConfig) =>
          ipc.getIdentityProvider("smithy.api#noAuth") || (async () => ({})),
        signer: new NoAuthSigner(),
      },
    ],
  };

  const withRetry = resolveRetryConfig(withDefaults as any);
  return resolveEndpointConfig(withRetry as any) as Record<string, any>;
}
