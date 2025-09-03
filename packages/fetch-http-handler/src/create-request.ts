import type { AdditionalRequestParameters } from "./fetch-http-handler";

/**
 * @internal
 * For mocking/interception.
 */
export function createRequest(url: string, requestOptions?: RequestInit & AdditionalRequestParameters) {
  return new Request(url, requestOptions);
}
