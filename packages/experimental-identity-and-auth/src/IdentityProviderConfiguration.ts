import { Identity, IdentityProvider } from "@smithy/types";

import { HttpAuthScheme, HttpAuthSchemeId } from "./HttpAuthScheme";

/**
 * Interface to get an IdentityProvider for a specified HttpAuthScheme
 * @internal
 */
export interface IdentityProviderConfiguration {
  /**
   * Get the IdentityProvider for a specified HttpAuthScheme.
   * @param schemeId schemeId of the HttpAuthScheme
   * @returns IdentityProvider or undefined if HttpAuthScheme is not found
   */
  getIdentityProvider(schemeId: HttpAuthSchemeId): IdentityProvider<Identity> | undefined;

  /**
   * Gets the configured HttpAuthSchemes.
   * @returns all configured HttpAuthSchemes
   */
  getAuthSchemes(): Map<HttpAuthSchemeId, HttpAuthScheme>;
}

/**
 * Default implementation of IdentityProviderConfiguration
 * @internal
 */
export class DefaultIdentityProviderConfiguration implements IdentityProviderConfiguration {
  private authSchemes: Map<HttpAuthSchemeId, HttpAuthScheme> = new Map();

  /**
   * Creates an IdentityProviderConfiguration with a list of HttpAuthSchemes.
   *
   * HttpAuthSchemes that have the same schemeId will be deduped, where the
   * HttpAuthScheme later in the list will have priority.
   * @param authSchemes auth schemes to configure
   */
  constructor(authSchemes: HttpAuthScheme[]) {
    for (const authScheme of authSchemes) {
      this.authSchemes.set(authScheme.schemeId, authScheme);
    }
  }

  public getIdentityProvider(schemeId: HttpAuthSchemeId): IdentityProvider<Identity> | undefined {
    return this.authSchemes.get(schemeId)?.identityProvider;
  }

  public getAuthSchemes(): Map<HttpAuthSchemeId, HttpAuthScheme> {
    return this.authSchemes;
  }
}
