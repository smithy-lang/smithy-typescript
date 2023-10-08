import {
  OnlySigv4AuthCommand,
  OnlySigv4AuthOptionalCommand,
  SameAsServiceCommand,
  Sigv4ServiceClient,
} from "@smithy/identity-and-auth-sigv4-service";
import { AwsCredentialIdentity } from "@smithy/types";
import { requireRequestsFrom } from "@smithy/util-test";

describe("@aws.auth#sigv4 integration tests", () => {
  // TODO(experimentalIdentityAndAuth): should match `Sigv4Service` `@aws.auth#sigv4` trait
  const MOCK_CREDENTIALS: AwsCredentialIdentity = {
    accessKeyId: "MOCK_ACCESS_KEY_ID",
    secretAccessKey: "SECRET_ACCESS_KEY",
    sessionToken: "SESSION_TOKEN",
  };
  const MOCK_REGION = "us-east-1";

  // Arbitrary mock endpoint (`requireRequestsFrom()` intercepts network requests)
  const MOCK_ENDPOINT = "https://foo.bar";

  describe("`@aws.auth#sigv4` `region` configuration", () => {
    it("Client should throw if `region` is not configured", async () => {
      const client = new Sigv4ServiceClient({
        endpoint: MOCK_ENDPOINT,
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new OnlySigv4AuthOptionalCommand({}))).rejects.toThrow(
        "expected `region` to be configured for `aws.auth#sigv4`"
      );
    });

    it("Client should NOT throw if `region` is configured", async () => {
      const client = new Sigv4ServiceClient({
        endpoint: MOCK_ENDPOINT,
        region: MOCK_REGION,
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          Authorization: (value) => expect(value).toBeUndefined(),
        },
      });
      await client.send(new OnlySigv4AuthOptionalCommand({}));
    });
  });

  describe("Operation requires `@aws.auth#sigv4`", () => {
    it("Request is thrown when `credentials` is not configured", async () => {
      const client = new Sigv4ServiceClient({
        endpoint: MOCK_ENDPOINT,
        region: MOCK_REGION,
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new OnlySigv4AuthCommand({}))).rejects.toThrow(
        "HttpAuthScheme `aws.auth#sigv4` did not have an IdentityProvider configured."
      );
    });

    it("Request is signed given configured `credentials`", async () => {
      const client = new Sigv4ServiceClient({
        endpoint: MOCK_ENDPOINT,
        region: MOCK_REGION,
        credentials: async () => MOCK_CREDENTIALS,
      });
      requireRequestsFrom(client).toMatch({});
      await client.send(new OnlySigv4AuthCommand({}));
    });
  });

  describe("Operation has `@aws.auth#sigv4` and `@optionalAuth`", () => {
    it("Request is NOT thrown and NOT signed when `credentials` is not configured", async () => {
      const client = new Sigv4ServiceClient({
        endpoint: MOCK_ENDPOINT,
        region: MOCK_REGION,
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          Authorization: (value) => expect(value).toBeUndefined(),
        },
      });
      await client.send(new OnlySigv4AuthOptionalCommand({}));
    });

    it("Request is signed given configured `credentials`", async () => {
      const client = new Sigv4ServiceClient({
        endpoint: MOCK_ENDPOINT,
        region: MOCK_REGION,
        credentials: async () => MOCK_CREDENTIALS,
      });
      requireRequestsFrom(client).toMatch({});
      await client.send(new OnlySigv4AuthOptionalCommand({}));
    });
  });

  describe("Service has `@aws.auth#sigv4`", () => {
    it("Request is thrown when `credentials` is not configured", async () => {
      const client = new Sigv4ServiceClient({
        endpoint: MOCK_ENDPOINT,
        region: MOCK_REGION,
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new SameAsServiceCommand({}))).rejects.toThrow(
        "HttpAuthScheme `aws.auth#sigv4` did not have an IdentityProvider configured."
      );
    });

    it("Request is signed given configured `credentials`", async () => {
      const client = new Sigv4ServiceClient({
        endpoint: MOCK_ENDPOINT,
        region: MOCK_REGION,
        credentials: async () => MOCK_CREDENTIALS,
      });
      requireRequestsFrom(client).toMatch({});
      await client.send(new SameAsServiceCommand({}));
    });
  });
});
