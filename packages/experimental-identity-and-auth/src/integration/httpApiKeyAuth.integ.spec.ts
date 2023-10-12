import { describe, it } from "@jest/globals";
import {
  HttpApiKeyAuthServiceClient,
  OnlyHttpApiKeyAuthCommand,
  OnlyHttpApiKeyAuthOptionalCommand,
  SameAsServiceCommand,
} from "@smithy/identity-and-auth-http-api-key-auth-service";

import { expectClientCommand } from "../util-test";

describe("@httpApiKeyAuth integration tests", () => {
  // TODO(experimentalIdentityAndAuth): should match `HttpApiKeyAuthService` `@httpApiKeyAuth` trait
  const MOCK_API_KEY_NAME = "Authorization";
  const MOCK_API_KEY_SCHEME = "ApiKey";
  const MOCK_API_KEY = "APIKEY_123";

  describe("Operation requires `@httpApiKeyAuth`", () => {
    it("Request is thrown when `apiKey` is not configured", async () => {
      await expectClientCommand({
        clientConstructor: HttpApiKeyAuthServiceClient,
        commandConstructor: OnlyHttpApiKeyAuthCommand,
        clientRejects: "HttpAuthScheme `smithy.api#httpApiKeyAuth` did not have an IdentityProvider configured.",
      });
    });

    it("Request is thrown when `apiKey` is configured incorrectly", async () => {
      await expectClientCommand({
        clientConstructor: HttpApiKeyAuthServiceClient,
        commandConstructor: OnlyHttpApiKeyAuthCommand,
        clientConfig: {
          apiKey: {},
        },
        clientRejects: "request could not be signed with `apiKey` since the `apiKey` is not defined",
      });
    });

    it("Request is thrown given configured `apiKey` identity provider throws", async () => {
      await expectClientCommand({
        clientConstructor: HttpApiKeyAuthServiceClient,
        commandConstructor: OnlyHttpApiKeyAuthCommand,
        clientConfig: {
          apiKey: async () => {
            throw new Error("IdentityProvider throws this error");
          },
        },
        clientRejects: "IdentityProvider throws this error",
      });
    });

    it("Request is signed given configured `apiKey` identity provider", async () => {
      await expectClientCommand({
        clientConstructor: HttpApiKeyAuthServiceClient,
        commandConstructor: OnlyHttpApiKeyAuthCommand,
        clientConfig: {
          apiKey: async () => ({
            apiKey: MOCK_API_KEY,
          }),
        },
        requestMatchers: {
          headers: {
            [MOCK_API_KEY_NAME]: `${MOCK_API_KEY_SCHEME} ${MOCK_API_KEY}`,
          },
        },
      });
    });

    it("Request is signed given configured `apiKey` identity", async () => {
      await expectClientCommand({
        clientConstructor: HttpApiKeyAuthServiceClient,
        commandConstructor: OnlyHttpApiKeyAuthCommand,
        clientConfig: {
          apiKey: {
            apiKey: MOCK_API_KEY,
          },
        },
        requestMatchers: {
          headers: {
            [MOCK_API_KEY_NAME]: `${MOCK_API_KEY_SCHEME} ${MOCK_API_KEY}`,
          },
        },
      });
    });
  });

  describe("Operation has `@httpApiKeyAuth` and `@optionalAuth`", () => {
    it("Request is NOT thrown and NOT signed when `apiKey` is not configured", async () => {
      await expectClientCommand({
        clientConstructor: HttpApiKeyAuthServiceClient,
        commandConstructor: OnlyHttpApiKeyAuthOptionalCommand,
      });
    });

    it("Request is thrown when `apiKey` is configured incorrectly", async () => {
      await expectClientCommand({
        clientConstructor: HttpApiKeyAuthServiceClient,
        commandConstructor: OnlyHttpApiKeyAuthOptionalCommand,
        clientConfig: {
          apiKey: {},
        },
        clientRejects: "request could not be signed with `apiKey` since the `apiKey` is not defined",
      });
    });

    it("Request is thrown given configured `apiKey` identity provider throws", async () => {
      await expectClientCommand({
        clientConstructor: HttpApiKeyAuthServiceClient,
        commandConstructor: OnlyHttpApiKeyAuthOptionalCommand,
        clientConfig: {
          apiKey: async () => {
            throw new Error("IdentityProvider throws this error");
          },
        },
        clientRejects: "IdentityProvider throws this error",
      });
    });

    it("Request is signed given configured `apiKey` identity provider", async () => {
      await expectClientCommand({
        clientConstructor: HttpApiKeyAuthServiceClient,
        commandConstructor: OnlyHttpApiKeyAuthOptionalCommand,
        clientConfig: {
          apiKey: async () => ({
            apiKey: MOCK_API_KEY,
          }),
        },
        requestMatchers: {
          headers: {
            [MOCK_API_KEY_NAME]: `${MOCK_API_KEY_SCHEME} ${MOCK_API_KEY}`,
          },
        },
      });
    });

    it("Request is signed given configured `apiKey` identity", async () => {
      await expectClientCommand({
        clientConstructor: HttpApiKeyAuthServiceClient,
        commandConstructor: OnlyHttpApiKeyAuthOptionalCommand,
        clientConfig: {
          apiKey: {
            apiKey: MOCK_API_KEY,
          },
        },
        requestMatchers: {
          headers: {
            [MOCK_API_KEY_NAME]: `${MOCK_API_KEY_SCHEME} ${MOCK_API_KEY}`,
          },
        },
      });
    });
  });

  describe("Service has `@httpApiKeyAuth`", () => {
    it("Request is thrown when `apiKey` is not configured", async () => {
      await expectClientCommand({
        clientConstructor: HttpApiKeyAuthServiceClient,
        commandConstructor: SameAsServiceCommand,
        clientRejects: "HttpAuthScheme `smithy.api#httpApiKeyAuth` did not have an IdentityProvider configured.",
      });
    });

    it("Request is thrown when `apiKey` is configured incorrectly", async () => {
      await expectClientCommand({
        clientConstructor: HttpApiKeyAuthServiceClient,
        commandConstructor: SameAsServiceCommand,
        clientConfig: {
          apiKey: {},
        },
        clientRejects: "request could not be signed with `apiKey` since the `apiKey` is not defined",
      });
    });

    it("Request is thrown given configured `apiKey` identity provider throws", async () => {
      await expectClientCommand({
        clientConstructor: HttpApiKeyAuthServiceClient,
        commandConstructor: OnlyHttpApiKeyAuthCommand,
        clientConfig: {
          apiKey: async () => {
            throw new Error("IdentityProvider throws this error");
          },
        },
        clientRejects: "IdentityProvider throws this error",
      });
    });

    it("Request is signed given configured `apiKey` identity provider", async () => {
      await expectClientCommand({
        clientConstructor: HttpApiKeyAuthServiceClient,
        commandConstructor: SameAsServiceCommand,
        clientConfig: {
          apiKey: async () => ({
            apiKey: MOCK_API_KEY,
          }),
        },
        requestMatchers: {
          headers: {
            [MOCK_API_KEY_NAME]: `${MOCK_API_KEY_SCHEME} ${MOCK_API_KEY}`,
          },
        },
      });
    });

    it("Request is signed given configured `apiKey` identity", async () => {
      await expectClientCommand({
        clientConstructor: HttpApiKeyAuthServiceClient,
        commandConstructor: SameAsServiceCommand,
        clientConfig: {
          apiKey: {
            apiKey: MOCK_API_KEY,
          },
        },
        requestMatchers: {
          headers: {
            [MOCK_API_KEY_NAME]: `${MOCK_API_KEY_SCHEME} ${MOCK_API_KEY}`,
          },
        },
      });
    });
  });
});
