import type { HeaderBag, HttpRequest } from "@smithy/types";

import { ALWAYS_UNSIGNABLE_HEADERS, PROXY_HEADER_PATTERN, SEC_HEADER_PATTERN } from "./constants";

/**
 * @internal
 */
export const getCanonicalHeaders = (
  { headers }: HttpRequest,
  unsignableHeaders?: Set<string>,
  signableHeaders?: Set<string>
): HeaderBag => {
  const canonical: HeaderBag = {};
  for (const headerName of Object.keys(headers).sort()) {
    if (headers[headerName] == undefined) {
      continue;
    }

    const canonicalHeaderName = headerName.toLowerCase();
    if (
      canonicalHeaderName in ALWAYS_UNSIGNABLE_HEADERS ||
      unsignableHeaders?.has(canonicalHeaderName) ||
      PROXY_HEADER_PATTERN.test(canonicalHeaderName) ||
      SEC_HEADER_PATTERN.test(canonicalHeaderName)
    ) {
      if (!signableHeaders || (signableHeaders && !signableHeaders.has(canonicalHeaderName))) {
        continue;
      }
    }

    // https://www.rfc-editor.org/rfc/rfc9110.html#name-field-values
    // https://www.rfc-editor.org/rfc/rfc9110.html#section-5.6.3
    canonical[canonicalHeaderName] = headers[headerName]
      .replace(/[\r\n]/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/^ | $/g, "");
  }

  return canonical;
};
