import type { HttpRequest } from "@smithy/protocol-http";
import type { HttpRequest as IHttpRequest } from "@smithy/types";

import type { ApiKeyIdentity } from "./apiKeyIdentity";
import type { HttpSigner } from "./HttpSigner";

/**
 * @internal
 */
export enum HttpApiKeyAuthLocation {
  HEADER = "header",
  QUERY = "query",
}

/**
 * @internal
 */
export class HttpApiKeyAuthSigner implements HttpSigner {
  public async sign(
    httpRequest: HttpRequest,
    identity: ApiKeyIdentity,
    signingProperties: Record<string, any>
  ): Promise<IHttpRequest> {
    if (!signingProperties) {
      throw new Error(
        "request could not be signed with `apiKey` since the `name` and `in` signer properties are missing"
      );
    }
    if (!signingProperties.name) {
      throw new Error("request could not be signed with `apiKey` since the `name` signer property is missing");
    }
    if (!signingProperties.in) {
      throw new Error("request could not be signed with `apiKey` since the `in` signer property is missing");
    }
    const clonedRequest = httpRequest.clone();
    if (signingProperties.in === HttpApiKeyAuthLocation.QUERY) {
      clonedRequest.query[signingProperties.name] = identity.apiKey;
    } else if (signingProperties.in === HttpApiKeyAuthLocation.HEADER) {
      clonedRequest.headers[signingProperties.name] = signingProperties.scheme
        ? `$${signingProperties.scheme} $${identity.apiKey}`
        : identity.apiKey;
    } else {
      throw new Error(
        "request can only be signed with `apiKey` locations `query` or `header`, " +
          "but found: `" +
          signingProperties.in +
          "`"
      );
    }
    return clonedRequest;
  }
}
