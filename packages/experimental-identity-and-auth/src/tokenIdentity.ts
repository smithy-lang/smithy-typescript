import type { Identity, IdentityProvider } from "@smithy/types";

/**
 * @internal
 */
export interface TokenIdentity extends Identity {
  /**
   * The literal token string
   */
  readonly token: string;
}

/**
 * @internal
 */
export type TokenIdentityProvider = IdentityProvider<TokenIdentity>;
