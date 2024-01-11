import { Identity, IdentityProvider } from "@smithy/types";

import { HttpAuthSchemeId } from "./HttpAuthScheme";

/**
 * Interface to get an IdentityProvider for a specified HttpAuthScheme
 * @internal
 */
export interface IdentityProviderConfig {
  /**
   * Get the IdentityProvider for a specified HttpAuthScheme.
   * @param schemeId schemeId of the HttpAuthScheme
   * @returns IdentityProvider or undefined if HttpAuthScheme is not found
   */
  getIdentityProvider(schemeId: HttpAuthSchemeId): IdentityProvider<Identity> | undefined;
}

/**
 * Default implementation of IdentityProviderConfig
 * @internal
 */
export class DefaultIdentityProviderConfig implements IdentityProviderConfig {
  private authSchemes: Map<HttpAuthSchemeId, IdentityProvider<Identity>> = new Map();

  /**
   * Creates an IdentityProviderConfig with a record of scheme IDs to identity providers.
   *
   * @param config scheme IDs and identity providers to configure
   */
  constructor(config: Record<HttpAuthSchemeId, IdentityProvider<Identity> | undefined>) {
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined) {
        this.authSchemes.set(key, value);
      }
    }
  }

  public getIdentityProvider(schemeId: HttpAuthSchemeId): IdentityProvider<Identity> | undefined {
    return this.authSchemes.get(schemeId);
  }
}
