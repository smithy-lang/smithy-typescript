import type { HttpRequest, Identity } from "@smithy/types";

import type { HttpSigner } from "./HttpSigner";

/**
 * Signer for the synthetic @smithy.api#noAuth auth scheme.
 * @internal
 */
export class NoAuthSigner implements HttpSigner {
  async sign(
    httpRequest: HttpRequest,
    identity: Identity,
    signingProperties: Record<string, unknown>
  ): Promise<HttpRequest> {
    return httpRequest;
  }
}
