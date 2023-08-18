import { Identity, IdentityProvider } from "@smithy/types";

import { HttpSigner } from "./HttpSigner";

/**
 * ID for {@link HttpAuthScheme}
 * @internal
 */
export type HttpAuthSchemeId = string;

/**
 * Interface that defines an HttpAuthScheme
 * @internal
 */
export interface HttpAuthScheme {
  /**
   * ID for an HttpAuthScheme, typically the absolute shape ID of a Smithy auth trait.
   */
  schemeId: HttpAuthSchemeId;
  /**
   * IdentityProvider corresponding to an HttpAuthScheme.
   */
  identityProvider: IdentityProvider<Identity>;
  /**
   * HttpSigner corresponding to an HttpAuthScheme.
   */
  signer: HttpSigner;
}

/**
 * Interface that defines the identity and signing properties when selecting
 * an HttpAuthScheme.
 * @internal
 */
export interface HttpAuthOption {
  schemeId: HttpAuthSchemeId;
  identityProperties?: Record<string, unknown>;
  signingProperties?: Record<string, unknown>;
}
