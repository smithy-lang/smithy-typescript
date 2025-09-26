import type { HttpAuthSchemeId, Identity, IdentityProvider, IdentityProviderConfig } from "@smithy/types";

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
