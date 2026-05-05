/* eslint-disable @typescript-eslint/no-unused-vars */
import { HttpRequest } from "@smithy/core/protocols";
import type { HttpSigner, HttpRequest as IHttpRequest, TokenIdentity } from "@smithy/types";

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
