import { hasOwn } from "@smithy/core/transport";

/**
 * Recursively parses object and populates value is node from
 * "#text" key if it's available
 *
 * @internal
 */
export const getValueFromTextNode = (obj: any) => {
  const textNodeName = "#text";

  for (const key in obj) {
    if (!hasOwn(obj, key)) continue;
    if (obj[key][textNodeName] !== undefined) {
      obj[key] = obj[key][textNodeName];
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      obj[key] = getValueFromTextNode(obj[key]);
    }
  }

  return obj;
};
