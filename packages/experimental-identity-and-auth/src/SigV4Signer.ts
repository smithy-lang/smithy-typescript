import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { AwsCredentialIdentity, HttpRequest as IHttpRequest } from "@smithy/types";

import { HttpSigner } from "./HttpSigner";

/**
 * @internal
 */
export class SigV4Signer implements HttpSigner {
  async sign(
    httpRequest: HttpRequest,
    identity: AwsCredentialIdentity,
    signingProperties: Record<string, any>
  ): Promise<IHttpRequest> {
    const clonedRequest = HttpRequest.clone(httpRequest);
    const signer = new SignatureV4({
      applyChecksum: signingProperties.applyChecksum !== undefined ? signingProperties.applyChecksum : true,
      credentials: identity,
      region: signingProperties.region,
      service: signingProperties.name,
      sha256: signingProperties.sha256,
      uriEscapePath: signingProperties.uriEscapePath !== undefined ? signingProperties.uriEscapePath : true,
    });
    return signer.sign(clonedRequest, {
      signingDate: new Date(),
      signableHeaders: signingProperties.signableHeaders,
      unsignableHeaders: signingProperties.unsignableHeaders,
      signingRegion: signingProperties.signingRegion,
      signingService: signingProperties.signingService,
    });
  }
}
