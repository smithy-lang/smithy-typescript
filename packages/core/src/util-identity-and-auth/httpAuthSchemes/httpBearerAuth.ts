/* eslint-disable @typescript-eslint/no-unused-vars */
import type { HttpRequest as IHttpRequest, HttpSigner, TokenIdentity } from "@smithy/types";

import { HttpRequest } from "../../submodules/protocols/protocol-http/httpRequest";

/**
 * @internal
 */
export class HttpBearerAuthSigner implements HttpSigner {
  public async sign(
    httpRequest: HttpRequest,
    identity: TokenIdentity,
    signingProperties: Record<string, any>
  ): Promise<IHttpRequest> {
    const clonedRequest = HttpRequest.clone(httpRequest);
    if (!identity.token) {
      throw new Error("request could not be signed with `token` since the `token` is not defined");
    }
    clonedRequest.headers["Authorization"] = `Bearer ${identity.token}`;
    return clonedRequest;
  }
}
