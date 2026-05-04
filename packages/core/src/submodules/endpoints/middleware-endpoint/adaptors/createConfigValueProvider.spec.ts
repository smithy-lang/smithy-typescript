import type { Endpoint } from "@smithy/types";
import { describe, expect, test as it } from "vitest";

import { createConfigValueProvider } from "./createConfigValueProvider";

describe(createConfigValueProvider.name, () => {
  it("should create a normalized provider for any config value", async () => {
    const config = {
      a: 1,
      b: 2,
    };
    expect(await createConfigValueProvider("a", "a", config)()).toEqual(1);
  });

  it("should look up both the canonical Endpoint ruleset param name and any localized override", async () => {
    const config = {
      a: 1,
      b: 2,
    };
    expect(await createConfigValueProvider("a", "x", config)()).toEqual(1);
    expect(await createConfigValueProvider("x", "a", config)()).toEqual(1);
  });

  it("uses a special lookup for CredentialScope", async () => {
    const config = {
      credentials: async () => {
        return {
          credentialScope: "cred-scope",
        };
      },
    };
    expect(await createConfigValueProvider("credentialScope", "CredentialScope", config)()).toEqual("cred-scope");
  });

  it("uses a special lookup for accountId", async () => {
    const config = {
      credentials: async () => {
        return {
          accountId: "123456789012",
        };
      },
    };
    expect(await createConfigValueProvider("accountId", "AccountId", config)()).toEqual("123456789012");
  });

  it("should normalize endpoint objects into URLs", async () => {
    const sampleUrl = "https://aws.amazon.com/";
    const config = {
      str: sampleUrl,
      v1: {
        protocol: "https:",
        hostname: new URL(sampleUrl).hostname,
        path: "/",
      } as Endpoint,
      v2: { url: new URL(sampleUrl) },
    };
    expect(await createConfigValueProvider("str", "endpoint", config)()).toEqual(sampleUrl);
    expect(await createConfigValueProvider("v1", "endpoint", config)()).toEqual(sampleUrl);
    expect(await createConfigValueProvider("v2", "endpoint", config)()).toEqual(sampleUrl);
  });

  it("should prioritize clientContextParams over direct properties", async () => {
    const config = {
      stage: "prod",
      clientContextParams: {
        stage: "beta",
      },
    };
    expect(await createConfigValueProvider("stage", "stage", config, true)()).toEqual("beta");
  });

  it("should fall back to direct property when clientContextParams is not provided", async () => {
    const config = {
      customParam: "direct-value",
    };
    expect(await createConfigValueProvider("customParam", "customParam", config)()).toEqual("direct-value");
  });

  it("should fall back to direct property when clientContextParams exists but param is not in it", async () => {
    const config = {
      customParam: "direct-value",
      clientContextParams: {
        otherParam: "other-value",
      },
    };
    expect(await createConfigValueProvider("customParam", "customParam", config)()).toEqual("direct-value");
  });
});
