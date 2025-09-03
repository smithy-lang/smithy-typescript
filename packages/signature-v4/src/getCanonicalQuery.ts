import type { HttpRequest } from "@smithy/types";
import { escapeUri } from "@smithy/util-uri-escape";

import { SIGNATURE_HEADER } from "./constants";

/**
 * @internal
 */
export const getCanonicalQuery = ({ query = {} }: HttpRequest): string => {
  const keys: Array<string> = [];
  const serialized: Record<string, string> = {};
  for (const key of Object.keys(query)) {
    if (key.toLowerCase() === SIGNATURE_HEADER) {
      continue;
    }

    const encodedKey = escapeUri(key);
    keys.push(encodedKey);
    const value = query[key];
    if (typeof value === "string") {
      serialized[encodedKey] = `${encodedKey}=${escapeUri(value)}`;
    } else if (Array.isArray(value)) {
      serialized[encodedKey] = value
        .slice(0)
        .reduce((encoded: Array<string>, value: string) => encoded.concat([`${encodedKey}=${escapeUri(value)}`]), [])
        .sort()
        .join("&");
    }
  }

  return keys
    .sort()
    .map((key) => serialized[key])
    .filter((serialized) => serialized) // omit any falsy values
    .join("&");
};
