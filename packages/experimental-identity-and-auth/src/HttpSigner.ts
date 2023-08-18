import { HttpRequest, Identity } from "@smithy/types";

/**
 * Interface to sign identity and signing properties.
 * @internal
 */
export interface HttpSigner {
  /**
   * Signs an HttpRequest with an identity and signing properties.
   * @param httpRequest request to sign
   * @param identity identity to sing the request with
   * @param signingProperties property bag for signing
   * @returns signed request in a promise
   */
  sign(httpRequest: HttpRequest, identity: Identity, signingProperties: Record<string, unknown>): Promise<HttpRequest>;
}
