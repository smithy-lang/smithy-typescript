import { describe, it } from "@jest/globals";
import {
  HttpBearerAuthServiceClient,
  OnlyHttpBearerAuthCommand,
  OnlyHttpBearerAuthOptionalCommand,
  SameAsServiceCommand,
} from "@smithy/identity-and-auth-http-bearer-auth-service";

import { expectClientCommand } from "../util-test";

describe("@httpBearerAuth integration tests", () => {
  // Arbitrary mock token
  const MOCK_TOKEN = "TOKEN_123";

  describe("Operation requires `@httpBearerAuth`", () => {
    it("Request is thrown when `token` is not configured", async () => {
      await expectClientCommand({
        clientConstructor: HttpBearerAuthServiceClient,
        commandConstructor: OnlyHttpBearerAuthCommand,
        clientRejects: "HttpAuthScheme `smithy.api#httpBearerAuth` did not have an IdentityProvider configured.",
      });
    });

    it("Request is thrown when `token` is configured incorrectly", async () => {
      await expectClientCommand({
        clientConstructor: HttpBearerAuthServiceClient,
        commandConstructor: OnlyHttpBearerAuthCommand,
        clientConfig: {
          token: {},
        },
        clientRejects: "request could not be signed with `token` since the `token` is not defined",
      });
    });

    it("Request is thrown given configured `token` identity provider throws", async () => {
      await expectClientCommand({
        clientConstructor: HttpBearerAuthServiceClient,
        commandConstructor: OnlyHttpBearerAuthCommand,
        clientConfig: {
          token: async () => {
            throw new Error("IdentityProvider throws this error");
          },
        },
        clientRejects: "IdentityProvider throws this error",
      });
    });

    it("Request is signed given configured `token` identity provider", async () => {
      await expectClientCommand({
        clientConstructor: HttpBearerAuthServiceClient,
        commandConstructor: OnlyHttpBearerAuthCommand,
        clientConfig: {
          token: async () => ({
            token: MOCK_TOKEN,
          }),
        },
        requestMatchers: {
          headers: {
            Authorization: `Bearer ${MOCK_TOKEN}`,
          },
        },
      });
    });

    it("Request is signed given configured `token` identity", async () => {
      await expectClientCommand({
        clientConstructor: HttpBearerAuthServiceClient,
        commandConstructor: OnlyHttpBearerAuthCommand,
        clientConfig: {
          token: {
            token: MOCK_TOKEN,
          },
        },
        requestMatchers: {
          headers: {
            Authorization: `Bearer ${MOCK_TOKEN}`,
          },
        },
      });
    });
  });

  describe("Operation has `@httpBearerAuth` and `@optionalAuth`", () => {
    it("Request is NOT thrown and NOT signed when `token` is not configured", async () => {
      await expectClientCommand({
        clientConstructor: HttpBearerAuthServiceClient,
        commandConstructor: OnlyHttpBearerAuthOptionalCommand,
      });
    });

    it("Request is thrown when `token` is configured incorrectly", async () => {
      await expectClientCommand({
        clientConstructor: HttpBearerAuthServiceClient,
        commandConstructor: OnlyHttpBearerAuthOptionalCommand,
        clientConfig: {
          token: {},
        },
        clientRejects: "request could not be signed with `token` since the `token` is not defined",
      });
    });

    it("Request is thrown given configured `token` identity provider throws", async () => {
      await expectClientCommand({
        clientConstructor: HttpBearerAuthServiceClient,
        commandConstructor: OnlyHttpBearerAuthOptionalCommand,
        clientConfig: {
          token: async () => {
            throw new Error("IdentityProvider throws this error");
          },
        },
        clientRejects: "IdentityProvider throws this error",
      });
    });

    it("Request is signed given configured `token` identity provider", async () => {
      await expectClientCommand({
        clientConstructor: HttpBearerAuthServiceClient,
        commandConstructor: OnlyHttpBearerAuthOptionalCommand,
        clientConfig: {
          token: async () => ({
            token: MOCK_TOKEN,
          }),
        },
        requestMatchers: {
          headers: {
            Authorization: `Bearer ${MOCK_TOKEN}`,
          },
        },
      });
    });

    it("Request is signed given configured `token` identity", async () => {
      await expectClientCommand({
        clientConstructor: HttpBearerAuthServiceClient,
        commandConstructor: OnlyHttpBearerAuthOptionalCommand,
        clientConfig: {
          token: {
            token: MOCK_TOKEN,
          },
        },
        requestMatchers: {
          headers: {
            Authorization: `Bearer ${MOCK_TOKEN}`,
          },
        },
      });
    });
  });

  describe("Service has `@httpBearerAuth`", () => {
    it("Request is thrown when `token` is not configured", async () => {
      await expectClientCommand({
        clientConstructor: HttpBearerAuthServiceClient,
        commandConstructor: SameAsServiceCommand,
        clientRejects: "HttpAuthScheme `smithy.api#httpBearerAuth` did not have an IdentityProvider configured.",
      });
    });

    it("Request is thrown when `token` is configured incorrectly", async () => {
      await expectClientCommand({
        clientConstructor: HttpBearerAuthServiceClient,
        commandConstructor: SameAsServiceCommand,
        clientConfig: {
          token: {},
        },
        clientRejects: "request could not be signed with `token` since the `token` is not defined",
      });
    });

    it("Request is thrown given configured `token` identity provider throws", async () => {
      await expectClientCommand({
        clientConstructor: HttpBearerAuthServiceClient,
        commandConstructor: SameAsServiceCommand,
        clientConfig: {
          token: async () => {
            throw new Error("IdentityProvider throws this error");
          },
        },
        clientRejects: "IdentityProvider throws this error",
      });
    });

    it("Request is signed given configured `token` identity provider", async () => {
      await expectClientCommand({
        clientConstructor: HttpBearerAuthServiceClient,
        commandConstructor: SameAsServiceCommand,
        clientConfig: {
          token: async () => ({
            token: MOCK_TOKEN,
          }),
        },
        requestMatchers: {
          headers: {
            Authorization: `Bearer ${MOCK_TOKEN}`,
          },
        },
      });
    });

    it("Request is signed given configured `token` identity", async () => {
      await expectClientCommand({
        clientConstructor: HttpBearerAuthServiceClient,
        commandConstructor: SameAsServiceCommand,
        clientConfig: {
          token: {
            token: MOCK_TOKEN,
          },
        },
        requestMatchers: {
          headers: {
            Authorization: `Bearer ${MOCK_TOKEN}`,
          },
        },
      });
    });
  });
});
