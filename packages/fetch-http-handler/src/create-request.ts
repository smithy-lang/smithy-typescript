import type { AdditionalRequestParameters } from "./fetch-http-handler";

/**
 * For mocking/interception.
 *
 * @internal
 */
export function createRequest(url: string, requestOptions?: RequestInit & AdditionalRequestParameters) {
  return new Request(url, requestOptions);
}
