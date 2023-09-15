import type { HttpRequest } from "@smithy/protocol-http";
import type { HttpRequest as IHttpRequest } from "@smithy/types";

import type { HttpSigner } from "./HttpSigner";
import type { TokenIdentity } from "./tokenIdentity";

/**
 * @internal
 */
export class HttpBearerAuthSigner implements HttpSigner {
  public async sign(
    httpRequest: HttpRequest,
    identity: TokenIdentity,
    signingProperties: Record<string, any>
  ): Promise<IHttpRequest> {
    const clonedRequest = httpRequest.clone();
    clonedRequest.headers["Authorization"] = `Bearer ${identity.token}`;
    return clonedRequest;
  }
}
