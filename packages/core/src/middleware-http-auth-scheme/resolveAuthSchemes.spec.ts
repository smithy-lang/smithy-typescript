import { HttpAuthScheme } from "@smithy/types";
import { describe, expect,it } from "vitest";

import { resolveAuthSchemes } from "./resolveAuthSchemes";

describe("resolveAuthSchemes", () => {
  const sigv4 = "sigv4";
  const sigv4a = "sigv4a";

  const mockSigV4AuthScheme = { schemeId: `aws.auth#${sigv4}` } as HttpAuthScheme;
  const mockSigV4aAuthScheme = { schemeId: `aws.auth#${sigv4a}` } as HttpAuthScheme;

  it("should return candidate auth schemes is preference list is not available", () => {
    const candidateAuthSchemes = [mockSigV4AuthScheme, mockSigV4aAuthScheme];
    expect(resolveAuthSchemes(candidateAuthSchemes, [])).toEqual(candidateAuthSchemes);

    // @ts-expect-error case where callee incorrectly passes undefined
    expect(resolveAuthSchemes(candidateAuthSchemes)).toEqual(candidateAuthSchemes);
  });

  it("should return auth scheme from preference if it's available", () => {
    expect(resolveAuthSchemes([mockSigV4AuthScheme, mockSigV4aAuthScheme], [sigv4a])).toEqual([
      mockSigV4aAuthScheme,
      mockSigV4AuthScheme,
    ]);

    expect(resolveAuthSchemes([mockSigV4AuthScheme, mockSigV4aAuthScheme], [sigv4a, sigv4])).toEqual([
      mockSigV4aAuthScheme,
      mockSigV4AuthScheme,
    ]);

    expect(resolveAuthSchemes([mockSigV4AuthScheme, mockSigV4aAuthScheme], [sigv4, sigv4a])).toEqual([
      mockSigV4AuthScheme,
      mockSigV4aAuthScheme,
    ]);
  });

  it("should ignore auth scheme from preference if it's not available", () => {
    expect(resolveAuthSchemes([mockSigV4AuthScheme], [sigv4a])).toEqual([mockSigV4AuthScheme]);
    expect(resolveAuthSchemes([mockSigV4AuthScheme], ["sigv3"])).toEqual([mockSigV4AuthScheme]);
  });
});
