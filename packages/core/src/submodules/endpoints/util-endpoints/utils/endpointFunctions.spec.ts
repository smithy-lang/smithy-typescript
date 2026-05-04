import { describe, expect, test as it } from "vitest";

import { endpointFunctions } from "./endpointFunctions";

describe("endpointFunctions", () => {
  it.each([
    "booleanEquals",
    "coalesce",
    "getAttr",
    "isSet",
    "isValidHostLabel",
    "ite",
    "not",
    "parseURL",
    "split",
    "stringEquals",
    "substring",
    "uriEncode",
  ])("exports %s as a function", (fnName) => {
    expect(typeof (endpointFunctions as Record<string, unknown>)[fnName]).toBe("function");
  });
});
