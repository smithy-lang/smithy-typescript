import { externalDataInterceptor } from "@smithy/core/config";
import { afterEach, beforeEach, describe, expect, test as it } from "vitest";

import { getEndpointFromConfig } from "./getEndpointFromConfig";

describe(getEndpointFromConfig.name, () => {
  const ORIGINAL_ENV = process.env;
  const fileRecord = externalDataInterceptor.getFileRecord();

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    for (const key of Object.keys(fileRecord)) {
      delete fileRecord[key];
    }
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    for (const key of Object.keys(fileRecord)) {
      delete fileRecord[key];
    }
  });

  it("returns the endpoint URL from AWS_ENDPOINT_URL", async () => {
    process.env.AWS_ENDPOINT_URL = "https://custom.endpoint";
    const result = await getEndpointFromConfig("some service");
    expect(result).toBe("https://custom.endpoint");
  });

  it("returns undefined when ignore is set via env var", async () => {
    process.env.AWS_ENDPOINT_URL = "https://custom.endpoint";
    process.env.AWS_IGNORE_CONFIGURED_ENDPOINT_URLS = "true";
    const result = await getEndpointFromConfig("some service");
    expect(result).toBeUndefined();
  });

  it("returns the endpoint URL when ignore is explicitly false", async () => {
    process.env.AWS_ENDPOINT_URL = "https://custom.endpoint";
    process.env.AWS_IGNORE_CONFIGURED_ENDPOINT_URLS = "false";
    const result = await getEndpointFromConfig("some service");
    expect(result).toBe("https://custom.endpoint");
  });

  it("returns undefined when no endpoint is configured", async () => {
    const result = await getEndpointFromConfig("some service");
    expect(result).toBeUndefined();
  });

  describe("source_profile isolation", () => {
    const configPath = "/tmp/test-source-profile-config";

    beforeEach(() => {
      process.env.AWS_CONFIG_FILE = configPath;
      process.env.AWS_SHARED_CREDENTIALS_FILE = "/tmp/test-source-profile-creds";
      externalDataInterceptor.interceptFile("/tmp/test-source-profile-creds", "");
    });

    it("does not read endpoint_url from a source_profile", async () => {
      process.env.AWS_PROFILE = "B";

      externalDataInterceptor.interceptFile(
        configPath,
        `[profile A]
endpoint_url = https://profile-a-endpoint.aws

[profile B]
source_profile = A
role_arn = arn:aws:iam::123456789012:role/roleB
`
      );

      const result = await getEndpointFromConfig("S3");
      expect(result).toBeUndefined();
    });

    it("reads endpoint_url from the active profile only", async () => {
      process.env.AWS_PROFILE = "B";

      externalDataInterceptor.interceptFile(
        configPath,
        `[profile A]
endpoint_url = https://profile-a-endpoint.aws

[profile B]
source_profile = A
role_arn = arn:aws:iam::123456789012:role/roleB
endpoint_url = https://profile-b-endpoint.aws
`
      );

      const result = await getEndpointFromConfig("S3");
      expect(result).toBe("https://profile-b-endpoint.aws");
    });
  });
});
