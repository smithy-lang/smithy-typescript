import {
  HttpApiKeyAuthServiceClient,
  OnlyHttpApiKeyAuthCommand,
  OnlyHttpApiKeyAuthOptionalCommand,
  SameAsServiceCommand,
} from "@smithy/identity-and-auth-http-api-key-auth-service";
import { requireRequestsFrom } from "@smithy/util-test";

describe("@httpApiKeyAuth integration tests", () => {
  // Match `HttpApiKeyAuthService` `@httpApiKeyAuth` trait
  const MOCK_API_KEY_NAME = "Authorization";
  const MOCK_API_KEY_SCHEME = "ApiKey";
  const MOCK_API_KEY = "APIKEY_123";

  // Arbitrary mock endpoint (`requireRequestsFrom()` intercepts network requests)
  const MOCK_ENDPOINT = "https://foo.bar";

  describe("Operation requires `@httpApiKeyAuth`", () => {
    it("Request is thrown when `apiKey` is not configured", async () => {
      const client = new HttpApiKeyAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new OnlyHttpApiKeyAuthCommand({}))).rejects.toThrow(
        "HttpAuthScheme `smithy.api#httpApiKeyAuth` did not have an IdentityProvider configured."
      );
    });

    it("Request is thrown when `apiKey` is configured incorrectly", async () => {
      const client = new HttpApiKeyAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        apiKey: {} as any,
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new OnlyHttpApiKeyAuthCommand({}))).rejects.toThrow(
        "request could not be signed with `apiKey` since the `apiKey` is not defined"
      );
    });

    it("Request is thrown given configured `apiKey` identity provider throws", async () => {
      const client = new HttpApiKeyAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        apiKey: async () => {
          throw new Error("IdentityProvider throws this error");
        },
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new OnlyHttpApiKeyAuthCommand({}))).rejects.toThrow(
        "IdentityProvider throws this error"
      );
    });

    it("Request is signed given configured `apiKey` identity provider", async () => {
      const client = new HttpApiKeyAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        apiKey: async () => ({
          apiKey: MOCK_API_KEY,
        }),
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          [MOCK_API_KEY_NAME]: `${MOCK_API_KEY_SCHEME} ${MOCK_API_KEY}`,
        },
      });
      await client.send(new OnlyHttpApiKeyAuthCommand({}));
    });

    it("Request is signed given configured `apiKey` identity", async () => {
      const client = new HttpApiKeyAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        apiKey: {
          apiKey: MOCK_API_KEY,
        },
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          [MOCK_API_KEY_NAME]: `${MOCK_API_KEY_SCHEME} ${MOCK_API_KEY}`,
        },
      });
      await client.send(new OnlyHttpApiKeyAuthCommand({}));
    });
  });

  describe("Operation has `@httpApiKeyAuth` and `@optionalAuth`", () => {
    it("Request is NOT thrown and NOT signed when `apiKey` is not configured", async () => {
      const client = new HttpApiKeyAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          [MOCK_API_KEY_NAME]: (value) => expect(value).toBeUndefined(),
        },
      });
      await client.send(new OnlyHttpApiKeyAuthOptionalCommand({}));
    });

    it("Request is thrown when `apiKey` is configured incorrectly", async () => {
      const client = new HttpApiKeyAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        apiKey: {} as any,
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new OnlyHttpApiKeyAuthOptionalCommand({}))).rejects.toThrow(
        "request could not be signed with `apiKey` since the `apiKey` is not defined"
      );
    });

    it("Request is thrown given configured `apiKey` identity provider throws", async () => {
      const client = new HttpApiKeyAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        apiKey: async () => {
          throw new Error("IdentityProvider throws this error");
        },
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new OnlyHttpApiKeyAuthOptionalCommand({}))).rejects.toThrow(
        "IdentityProvider throws this error"
      );
    });

    it("Request is signed given configured `apiKey` identity provider", async () => {
      const client = new HttpApiKeyAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        apiKey: async () => ({
          apiKey: MOCK_API_KEY,
        }),
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          [MOCK_API_KEY_NAME]: `${MOCK_API_KEY_SCHEME} ${MOCK_API_KEY}`,
        },
      });
      await client.send(new OnlyHttpApiKeyAuthOptionalCommand({}));
    });

    it("Request is signed given configured `apiKey` identity", async () => {
      const client = new HttpApiKeyAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        apiKey: {
          apiKey: MOCK_API_KEY,
        },
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          [MOCK_API_KEY_NAME]: `${MOCK_API_KEY_SCHEME} ${MOCK_API_KEY}`,
        },
      });
      await client.send(new OnlyHttpApiKeyAuthOptionalCommand({}));
    });
  });

  describe("Service has `@httpApiKeyAuth`", () => {
    it("Request is thrown when `apiKey` is not configured", async () => {
      const client = new HttpApiKeyAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new SameAsServiceCommand({}))).rejects.toThrow(
        "HttpAuthScheme `smithy.api#httpApiKeyAuth` did not have an IdentityProvider configured."
      );
    });

    it("Request is thrown when `apiKey` is configured incorrectly", async () => {
      const client = new HttpApiKeyAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        apiKey: {} as any,
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new SameAsServiceCommand({}))).rejects.toThrow(
        "request could not be signed with `apiKey` since the `apiKey` is not defined"
      );
    });

    it("Request is thrown given configured `apiKey` identity provider throws", async () => {
      const client = new HttpApiKeyAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        apiKey: async () => {
          throw new Error("IdentityProvider throws this error");
        },
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new SameAsServiceCommand({}))).rejects.toThrow("IdentityProvider throws this error");
    });

    it("Request is signed given configured `apiKey` identity provider", async () => {
      const client = new HttpApiKeyAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        apiKey: async () => ({
          apiKey: MOCK_API_KEY,
        }),
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          [MOCK_API_KEY_NAME]: `${MOCK_API_KEY_SCHEME} ${MOCK_API_KEY}`,
        },
      });
      await client.send(new SameAsServiceCommand({}));
    });

    it("Request is signed given configured `apiKey` identity", async () => {
      const client = new HttpApiKeyAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        apiKey: {
          apiKey: MOCK_API_KEY,
        },
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          [MOCK_API_KEY_NAME]: `${MOCK_API_KEY_SCHEME} ${MOCK_API_KEY}`,
        },
      });
      await client.send(new SameAsServiceCommand({}));
    });
  });
});
