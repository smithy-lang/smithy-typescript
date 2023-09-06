import { Identity, IdentityProvider } from "@smithy/types";

/**
 * @internal
 */
export interface ApiKeyIdentity extends Identity {
  readonly apiKey: string;
}

/**
 * @internal
 */
export type ApiKeyIdentityProvider = IdentityProvider<ApiKeyIdentity>;
