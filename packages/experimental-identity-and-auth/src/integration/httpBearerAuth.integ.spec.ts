import {
  HttpBearerAuthServiceClient,
  OnlyHttpBearerAuthCommand,
  OnlyHttpBearerAuthOptionalCommand,
  SameAsServiceCommand,
} from "@smithy/identity-and-auth-http-bearer-auth-service";
import { requireRequestsFrom } from "@smithy/util-test";
import { describe, expect,test as it } from "vitest";

describe("@httpBearerAuth integration tests", () => {
  // Arbitrary mock token
  const MOCK_TOKEN = "TOKEN_123";

  // Arbitrary mock endpoint (`requireRequestsFrom()` intercepts network requests)
  const MOCK_ENDPOINT = "https://foo.bar";

  describe("Operation requires `@httpBearerAuth`", () => {
    it("Request is thrown when `token` is not configured", async () => {
      const client = new HttpBearerAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new OnlyHttpBearerAuthCommand({}))).rejects.toThrow(
        "HttpAuthScheme `smithy.api#httpBearerAuth` did not have an IdentityProvider configured."
      );
    });

    it("Request is thrown when `token` is configured incorrectly", async () => {
      const client = new HttpBearerAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        token: {} as any,
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new OnlyHttpBearerAuthCommand({}))).rejects.toThrow(
        "request could not be signed with `token` since the `token` is not defined"
      );
    });

    it("Request is thrown given configured `token` identity provider throws", async () => {
      const client = new HttpBearerAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        token: async () => {
          throw new Error("IdentityProvider throws this error");
        },
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new OnlyHttpBearerAuthCommand({}))).rejects.toThrow(
        "IdentityProvider throws this error"
      );
    });

    it("Request is signed given configured `token` identity provider", async () => {
      const client = new HttpBearerAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        token: async () => ({
          token: MOCK_TOKEN,
        }),
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          Authorization: `Bearer ${MOCK_TOKEN}`,
        },
      });
      await client.send(new OnlyHttpBearerAuthCommand({}));
    });

    it("Request is signed given configured `token` identity", async () => {
      const client = new HttpBearerAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        token: {
          token: MOCK_TOKEN,
        },
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          Authorization: `Bearer ${MOCK_TOKEN}`,
        },
      });
      await client.send(new OnlyHttpBearerAuthCommand({}));
    });
  });

  describe("Operation has `@httpBearerAuth` and `@optionalAuth`", () => {
    it("Request is NOT thrown and NOT signed when `token` is not configured", async () => {
      const client = new HttpBearerAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          Authorization: (value) => expect(value).toBeUndefined(),
        },
      });
      await client.send(new OnlyHttpBearerAuthOptionalCommand({}));
    });

    it("Request is thrown when `token` is configured incorrectly", async () => {
      const client = new HttpBearerAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        token: {} as any,
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new OnlyHttpBearerAuthOptionalCommand({}))).rejects.toThrow(
        "request could not be signed with `token` since the `token` is not defined"
      );
    });

    it("Request is thrown given configured `token` identity provider throws", async () => {
      const client = new HttpBearerAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        token: async () => {
          throw new Error("IdentityProvider throws this error");
        },
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new OnlyHttpBearerAuthOptionalCommand({}))).rejects.toThrow(
        "IdentityProvider throws this error"
      );
    });

    it("Request is signed given configured `token` identity provider", async () => {
      const client = new HttpBearerAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        token: async () => ({
          token: MOCK_TOKEN,
        }),
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          Authorization: `Bearer ${MOCK_TOKEN}`,
        },
      });
      await client.send(new OnlyHttpBearerAuthOptionalCommand({}));
    });

    it("Request is signed given configured `token` identity", async () => {
      const client = new HttpBearerAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        token: {
          token: MOCK_TOKEN,
        },
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          Authorization: `Bearer ${MOCK_TOKEN}`,
        },
      });
      await client.send(new OnlyHttpBearerAuthOptionalCommand({}));
    });
  });

  describe("Service has `@httpBearerAuth`", () => {
    it("Request is thrown when `token` is not configured", async () => {
      const client = new HttpBearerAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new SameAsServiceCommand({}))).rejects.toThrow(
        "HttpAuthScheme `smithy.api#httpBearerAuth` did not have an IdentityProvider configured."
      );
    });

    it("Request is thrown when `token` is configured incorrectly", async () => {
      const client = new HttpBearerAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        token: {} as any,
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new SameAsServiceCommand({}))).rejects.toThrow(
        "request could not be signed with `token` since the `token` is not defined"
      );
    });

    it("Request is thrown given configured `token` identity provider throws", async () => {
      const client = new HttpBearerAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        token: async () => {
          throw new Error("IdentityProvider throws this error");
        },
      });
      requireRequestsFrom(client).toMatch({});
      await expect(client.send(new SameAsServiceCommand({}))).rejects.toThrow("IdentityProvider throws this error");
    });

    it("Request is signed given configured `token` identity provider", async () => {
      const client = new HttpBearerAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        token: async () => ({
          token: MOCK_TOKEN,
        }),
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          Authorization: `Bearer ${MOCK_TOKEN}`,
        },
      });
      await client.send(new SameAsServiceCommand({}));
    });

    it("Request is signed given configured `token` identity", async () => {
      const client = new HttpBearerAuthServiceClient({
        endpoint: MOCK_ENDPOINT,
        token: {
          token: MOCK_TOKEN,
        },
      });
      requireRequestsFrom(client).toMatch({
        headers: {
          Authorization: `Bearer ${MOCK_TOKEN}`,
        },
      });
      await client.send(new SameAsServiceCommand({}));
    });
  });
});
