import { describe, expect, test } from "@jest/globals";
import {
  HttpApiKeyAuthLocation,
  HttpApiKeyAuthSigner,
  HttpBearerAuthSigner,
  NoAuthSigner,
  SigV4Signer,
} from "@smithy/experimental-identity-and-auth";
import { DefaultAuthServiceClient } from "@smithy/identity-and-auth-service-default-multi-auth-service";
import * as DAS from "@smithy/identity-and-auth-service-default-multi-auth-service";
import { EmptyAuthServiceClient } from "@smithy/identity-and-auth-service-empty-auth-service";
import * as EAS from "@smithy/identity-and-auth-service-empty-auth-service";
import { SpecifiedAuthServiceClient } from "@smithy/identity-and-auth-service-specified-multi-auth-service";
import * as SAS from "@smithy/identity-and-auth-service-specified-multi-auth-service";
import { AwsCredentialIdentity } from "@smithy/types";

import { expectClientCommand, getSelectedHttpAuthScheme } from "../util-test";

describe("Generic Identity and Auth", () => {
  // Arbitrary region
  const MOCK_REGION = "us-east-1";

  // TODO(experimentalIdentityAndAuth): should match `DefaultAuthService` / `EmptyAuthService` / `SpecificAuthService` `@httpApiKeyAuth` trait
  const MOCK_API_KEY_NAME = "X-Api-Key";
  const MOCK_API_KEY = "APIKEY_123";

  // Arbitrary mock token
  const MOCK_TOKEN = "TOKEN_123";

  // Arbitrary mock credentials
  const MOCK_CREDENTIALS: AwsCredentialIdentity = {
    accessKeyId: "MOCK_ACCESS_KEY_ID",
    secretAccessKey: "SECRET_ACCESS_KEY",
    sessionToken: "SESSION_TOKEN",
  };

  describe("Default Service Auth Resolution (no `@auth` trait)", () => {
    describe("Operation that uses the default service auth order", () => {
      test("should throw request with no config", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.SameAsServiceCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
          clientRejects:
            `HttpAuthScheme \`aws.auth#sigv4\` did not have an IdentityProvider configured.\n` +
            `HttpAuthScheme \`common#fakeAuth\` was not enabled for this service.\n` +
            `HttpAuthScheme \`smithy.api#httpApiKeyAuth\` did not have an IdentityProvider configured.\n` +
            `HttpAuthScheme \`smithy.api#httpBearerAuth\` did not have an IdentityProvider configured.`,
        });
      });

      test("should resolve the first auth trait in default model order (`@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.SameAsServiceCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
          },
          requestMatchers: {
            headers: {
              authorization: (val: any) => expect(val).toBeDefined(),
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "aws.auth#sigv4",
                signingProperties: {
                  name: "weather",
                  region: MOCK_REGION,
                },
                configPropertiesExtractor: expect.anything(),
              },
              identity: MOCK_CREDENTIALS,
              signer: expect.any(SigV4Signer),
            });
          },
        });
      });

      test("should skip the unsupported codegen `@common#fakeAuth` (before `@httpApiKeyAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.SameAsServiceCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => {
              throw new Error("after `common#fakeAuth`");
            },
          },
          clientRejects: "after `common#fakeAuth`",
        });
      });

      test("should resolve earlier auth trait given configs (`@httpApiKeyAuth`, `@httpBearerAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.SameAsServiceCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              [MOCK_API_KEY_NAME]: MOCK_API_KEY,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpApiKeyAuth",
                signingProperties: {
                  name: MOCK_API_KEY_NAME,
                  in: HttpApiKeyAuthLocation.HEADER,
                  scheme: undefined,
                },
              },
              identity: {
                apiKey: MOCK_API_KEY,
              },
              signer: expect.any(HttpApiKeyAuthSigner),
            });
          },
        });
      });

      test("should resolve last auth trait (`@httpBearerAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.SameAsServiceCommand,
          clientConfig: {
            region: MOCK_REGION,
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              Authorization: `Bearer ${MOCK_TOKEN}`,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpBearerAuth",
              },
              identity: {
                token: MOCK_TOKEN,
              },
              signer: expect.any(HttpBearerAuthSigner),
            });
          },
        });
      });

      test("should resolve first auth trait (`@aws.auth#sigv4`) given all auth have configs", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.SameAsServiceCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              authorization: (val: any) => expect(val).toBeDefined(),
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "aws.auth#sigv4",
                signingProperties: {
                  name: "weather",
                  region: MOCK_REGION,
                },
                configPropertiesExtractor: expect.anything(),
              },
              identity: MOCK_CREDENTIALS,
              signer: expect.any(SigV4Signer),
            });
          },
        });
      });
    });

    describe("Operation that uses the default service auth order and `@optionalAuth`", () => {
      test("should resolve to `smithy.api#noAuth` with no config", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.SameAsServiceOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });

      test("should resolve the first auth trait in default model order (`@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.SameAsServiceOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
          },
          requestMatchers: {
            headers: {
              authorization: (val: any) => expect(val).toBeDefined(),
            },
          },
        });
      });

      test("should skip the unsupported codegen `@common#fakeAuth` (before `@httpApiKeyAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.SameAsServiceOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => {
              throw new Error("after `common#fakeAuth`");
            },
          },
          clientRejects: "after `common#fakeAuth`",
        });
      });

      test("should resolve earlier auth trait given configs (`@httpApiKeyAuth`, `@httpBearerAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.SameAsServiceOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              [MOCK_API_KEY_NAME]: MOCK_API_KEY,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpApiKeyAuth",
                signingProperties: {
                  name: MOCK_API_KEY_NAME,
                  in: HttpApiKeyAuthLocation.HEADER,
                  scheme: undefined,
                },
              },
              identity: {
                apiKey: MOCK_API_KEY,
              },
              signer: expect.any(HttpApiKeyAuthSigner),
            });
          },
        });
      });

      test("should resolve last auth trait (`@httpBearerAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.SameAsServiceOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              Authorization: `Bearer ${MOCK_TOKEN}`,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpBearerAuth",
              },
              identity: {
                token: MOCK_TOKEN,
              },
              signer: expect.any(HttpBearerAuthSigner),
            });
          },
        });
      });

      test("should resolve first auth trait (`@aws.auth#sigv4`) given all auth have configs", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.SameAsServiceOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              authorization: (val: any) => expect(val).toBeDefined(),
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "aws.auth#sigv4",
                signingProperties: {
                  name: "weather",
                  region: MOCK_REGION,
                },
                configPropertiesExtractor: expect.anything(),
              },
              identity: MOCK_CREDENTIALS,
              signer: expect.any(SigV4Signer),
            });
          },
        });
      });
    });

    describe("Operation that specifies the `@auth` trait", () => {
      test("should throw request with no config", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
          clientRejects:
            `HttpAuthScheme \`smithy.api#httpBearerAuth\` did not have an IdentityProvider configured.\n` +
            `HttpAuthScheme \`smithy.api#httpApiKeyAuth\` did not have an IdentityProvider configured.\n` +
            `HttpAuthScheme \`common#fakeAuth\` was not enabled for this service.\n` +
            `HttpAuthScheme \`aws.auth#sigv4\` did not have an IdentityProvider configured.`,
        });
      });

      test("should resolve the first auth trait in the specified `@auth` trait order (`@httpBearerAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              Authorization: `Bearer ${MOCK_TOKEN}`,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpBearerAuth",
              },
              identity: {
                token: MOCK_TOKEN,
              },
              signer: expect.any(HttpBearerAuthSigner),
            });
          },
        });
      });

      test("should skip the unsupported codegen `@common#fakeAuth` (before `@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => {
              throw new Error("after `common#fakeAuth`");
            },
          },
          clientRejects: "after `common#fakeAuth`",
        });
      });

      test("should resolve earlier auth trait given configs (`@httpApiKeyAuth`, `@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            credentials: async () => MOCK_CREDENTIALS,
          },
          requestMatchers: {
            headers: {
              [MOCK_API_KEY_NAME]: MOCK_API_KEY,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpApiKeyAuth",
                signingProperties: {
                  name: MOCK_API_KEY_NAME,
                  in: HttpApiKeyAuthLocation.HEADER,
                  scheme: undefined,
                },
              },
              identity: {
                apiKey: MOCK_API_KEY,
              },
              signer: expect.any(HttpApiKeyAuthSigner),
            });
          },
        });
      });

      test("should resolve last auth trait (`@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
          },
          requestMatchers: {
            headers: {
              authorization: (val: any) => expect(val).toBeDefined(),
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "aws.auth#sigv4",
                signingProperties: {
                  name: "weather",
                  region: MOCK_REGION,
                },
                configPropertiesExtractor: expect.anything(),
              },
              identity: MOCK_CREDENTIALS,
              signer: expect.any(SigV4Signer),
            });
          },
        });
      });

      test("should resolve first auth trait (`@httpBearerAuth`) given all auth have configs", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              Authorization: `Bearer ${MOCK_TOKEN}`,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpBearerAuth",
              },
              identity: {
                token: MOCK_TOKEN,
              },
              signer: expect.any(HttpBearerAuthSigner),
            });
          },
        });
      });
    });

    describe("Operation that specifies the `@auth` trait and `@optionalAuth`", () => {
      test("should resolve to `smithy.api#noAuth` with no config", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });

      test("should resolve the first auth trait in the specified `@auth` trait order (`@httpBearerAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              Authorization: `Bearer ${MOCK_TOKEN}`,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpBearerAuth",
              },
              identity: {
                token: MOCK_TOKEN,
              },
              signer: expect.any(HttpBearerAuthSigner),
            });
          },
        });
      });

      test("should skip the unsupported codegen `@common#fakeAuth` (before `@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => {
              throw new Error("after `common#fakeAuth`");
            },
          },
          clientRejects: "after `common#fakeAuth`",
        });
      });

      test("should resolve earlier auth trait given configs (`@httpApiKeyAuth`, `@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            credentials: async () => MOCK_CREDENTIALS,
          },
          requestMatchers: {
            headers: {
              [MOCK_API_KEY_NAME]: MOCK_API_KEY,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpApiKeyAuth",
                signingProperties: {
                  name: MOCK_API_KEY_NAME,
                  in: HttpApiKeyAuthLocation.HEADER,
                  scheme: undefined,
                },
              },
              identity: {
                apiKey: MOCK_API_KEY,
              },
              signer: expect.any(HttpApiKeyAuthSigner),
            });
          },
        });
      });

      test("should resolve last auth trait (`@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
          },
          requestMatchers: {
            headers: {
              authorization: (val: any) => expect(val).toBeDefined(),
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "aws.auth#sigv4",
                signingProperties: {
                  name: "weather",
                  region: MOCK_REGION,
                },
                configPropertiesExtractor: expect.anything(),
              },
              identity: MOCK_CREDENTIALS,
              signer: expect.any(SigV4Signer),
            });
          },
        });
      });

      test("should resolve first auth trait (`@httpBearerAuth`) given all auth have configs", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              Authorization: `Bearer ${MOCK_TOKEN}`,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpBearerAuth",
              },
              identity: {
                token: MOCK_TOKEN,
              },
              signer: expect.any(HttpBearerAuthSigner),
            });
          },
        });
      });
    });

    describe("Operation that uses an empty `@auth` trait", () => {
      test("should resolve to `smithy.api#noAuth` with no config", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.OperationEmptyAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });

      test("should resolve to `smithy.api#noAuth` with config", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.OperationEmptyAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
            credentials: async () => MOCK_CREDENTIALS,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });
    });

    describe("Operation that uses an empty `@auth` trait and `@optionalAuth`", () => {
      test("should resolve to `smithy.api#noAuth` with no config", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.OperationEmptyAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });

      test("should resolve to `smithy.api#noAuth` with config", async () => {
        await expectClientCommand({
          clientConstructor: DefaultAuthServiceClient,
          commandConstructor: DAS.OperationEmptyAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
            credentials: async () => MOCK_CREDENTIALS,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });
    });
  });

  describe("Empty Service Auth Resolution (empty `@auth` trait)", () => {
    describe("Operation that uses the service empty `@auth` trait", () => {
      test("should resolve to `smithy.api#noAuth` with no config", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.SameAsServiceCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
        });
      });

      test("should resolve to `smithy.api#noAuth` with config", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.SameAsServiceCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
            credentials: async () => MOCK_CREDENTIALS,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });
    });

    describe("Operation that uses the service empty `@auth` trait and `@optionalAuth`", () => {
      test("should resolve to `smithy.api#noAuth` with no config", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.SameAsServiceOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
        });
      });

      test("should resolve to `smithy.api#noAuth` with config", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.SameAsServiceOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
            credentials: async () => MOCK_CREDENTIALS,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });
    });

    describe("Operation that specifies the `@auth` trait", () => {
      test("should throw request with no config", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
          clientRejects:
            `HttpAuthScheme \`aws.auth#sigv4\` did not have an IdentityProvider configured.\n` +
            `HttpAuthScheme \`common#fakeAuth\` was not enabled for this service.\n` +
            `HttpAuthScheme \`smithy.api#httpApiKeyAuth\` did not have an IdentityProvider configured.\n` +
            `HttpAuthScheme \`smithy.api#httpBearerAuth\` did not have an IdentityProvider configured.`,
        });
      });

      test("should resolve the first auth trait in specified `@auth` trait order (`@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
          },
          requestMatchers: {
            headers: {
              authorization: (val: any) => expect(val).toBeDefined(),
            },
          },
        });
      });

      test("should skip the unsupported codegen `@common#fakeAuth` (before `@httpApiKeyAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => {
              throw new Error("after `common#fakeAuth`");
            },
          },
          clientRejects: "after `common#fakeAuth`",
        });
      });

      test("should resolve earlier auth trait given configs (`@httpApiKeyAuth`, `@httpBearerAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              [MOCK_API_KEY_NAME]: MOCK_API_KEY,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpApiKeyAuth",
                signingProperties: {
                  name: MOCK_API_KEY_NAME,
                  in: HttpApiKeyAuthLocation.HEADER,
                  scheme: undefined,
                },
              },
              identity: {
                apiKey: MOCK_API_KEY,
              },
              signer: expect.any(HttpApiKeyAuthSigner),
            });
          },
        });
      });

      test("should resolve last auth trait (`@httpBearerAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              Authorization: `Bearer ${MOCK_TOKEN}`,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpBearerAuth",
              },
              identity: {
                token: MOCK_TOKEN,
              },
              signer: expect.any(HttpBearerAuthSigner),
            });
          },
        });
      });

      test("should resolve first auth trait (`@aws.auth#sigv4`) given all auth have configs", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              authorization: (val: any) => expect(val).toBeDefined(),
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "aws.auth#sigv4",
                signingProperties: {
                  name: "weather",
                  region: MOCK_REGION,
                },
                configPropertiesExtractor: expect.anything(),
              },
              identity: MOCK_CREDENTIALS,
              signer: expect.any(SigV4Signer),
            });
          },
        });
      });
    });

    describe("Operation that specifies the `@auth` trait and `@optionalAuth`", () => {
      test("should resolve to `smithy.api#noAuth` with no config", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });

      test("should resolve the first auth trait in specified `@auth` trait order (`@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
          },
          requestMatchers: {
            headers: {
              authorization: (val: any) => expect(val).toBeDefined(),
            },
          },
        });
      });

      test("should skip the unsupported codegen `@common#fakeAuth` (before `@httpApiKeyAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => {
              throw new Error("after `common#fakeAuth`");
            },
          },
          clientRejects: "after `common#fakeAuth`",
        });
      });

      test("should resolve earlier auth trait given configs (`@httpApiKeyAuth`, `@httpBearerAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              [MOCK_API_KEY_NAME]: MOCK_API_KEY,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpApiKeyAuth",
                signingProperties: {
                  name: MOCK_API_KEY_NAME,
                  in: HttpApiKeyAuthLocation.HEADER,
                  scheme: undefined,
                },
              },
              identity: {
                apiKey: MOCK_API_KEY,
              },
              signer: expect.any(HttpApiKeyAuthSigner),
            });
          },
        });
      });

      test("should resolve last auth trait (`@httpBearerAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              Authorization: `Bearer ${MOCK_TOKEN}`,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpBearerAuth",
              },
              identity: {
                token: MOCK_TOKEN,
              },
              signer: expect.any(HttpBearerAuthSigner),
            });
          },
        });
      });

      test("should resolve first auth trait (`@aws.auth#sigv4`) given all auth have configs", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              authorization: (val: any) => expect(val).toBeDefined(),
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "aws.auth#sigv4",
                signingProperties: {
                  name: "weather",
                  region: MOCK_REGION,
                },
                configPropertiesExtractor: expect.anything(),
              },
              identity: MOCK_CREDENTIALS,
              signer: expect.any(SigV4Signer),
            });
          },
        });
      });
    });

    describe("Operation that uses an empty `@auth` trait", () => {
      test("should resolve to `smithy.api#noAuth` with no config", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.OperationEmptyAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });

      test("should resolve to `smithy.api#noAuth` with config", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.OperationEmptyAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
            credentials: async () => MOCK_CREDENTIALS,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });
    });

    describe("Operation that uses an empty `@auth` trait and `@optionalAuth`", () => {
      test("should resolve to `smithy.api#noAuth` with no config", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.OperationEmptyAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });

      test("should resolve to `smithy.api#noAuth` with config", async () => {
        await expectClientCommand({
          clientConstructor: EmptyAuthServiceClient,
          commandConstructor: EAS.OperationEmptyAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
            credentials: async () => MOCK_CREDENTIALS,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });
    });
  });

  describe("Specified Service Auth Resolution (`@auth` trait)", () => {
    describe("Operation that uses the specified service `@auth` trait order", () => {
      test("should throw request with no config", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.SameAsServiceCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
          clientRejects:
            `HttpAuthScheme \`smithy.api#httpBearerAuth\` did not have an IdentityProvider configured.\n` +
            `HttpAuthScheme \`smithy.api#httpApiKeyAuth\` did not have an IdentityProvider configured.\n` +
            `HttpAuthScheme \`common#fakeAuth\` was not enabled for this service.\n` +
            `HttpAuthScheme \`aws.auth#sigv4\` did not have an IdentityProvider configured.`,
        });
      });

      test("should resolve the first auth trait in specified `@auth` trait order (`@httpBearerAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.SameAsServiceCommand,
          clientConfig: {
            region: MOCK_REGION,
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              Authorization: `Bearer ${MOCK_TOKEN}`,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpBearerAuth",
              },
              identity: {
                token: MOCK_TOKEN,
              },
              signer: expect.any(HttpBearerAuthSigner),
            });
          },
        });
      });

      test("should skip the unsupported codegen `@common#fakeAuth` (before `@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.SameAsServiceCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => {
              throw new Error("after `common#fakeAuth`");
            },
          },
          clientRejects: "after `common#fakeAuth`",
        });
      });

      test("should resolve earlier auth trait given configs (`@httpApiKeyAuth`, `@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.SameAsServiceCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            credentials: async () => MOCK_CREDENTIALS,
          },
          requestMatchers: {
            headers: {
              [MOCK_API_KEY_NAME]: MOCK_API_KEY,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpApiKeyAuth",
                signingProperties: {
                  name: MOCK_API_KEY_NAME,
                  in: HttpApiKeyAuthLocation.HEADER,
                  scheme: undefined,
                },
              },
              identity: {
                apiKey: MOCK_API_KEY,
              },
              signer: expect.any(HttpApiKeyAuthSigner),
            });
          },
        });
      });

      test("should resolve last auth trait (`@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.SameAsServiceCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
          },
          requestMatchers: {
            headers: {
              authorization: (val: any) => expect(val).toBeDefined(),
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "aws.auth#sigv4",
                signingProperties: {
                  name: "weather",
                  region: MOCK_REGION,
                },
                configPropertiesExtractor: expect.anything(),
              },
              identity: MOCK_CREDENTIALS,
              signer: expect.any(SigV4Signer),
            });
          },
        });
      });

      test("should resolve first auth trait (`@httpBearerAuth`) given all auth have configs", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.SameAsServiceCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              Authorization: `Bearer ${MOCK_TOKEN}`,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpBearerAuth",
              },
              identity: {
                token: MOCK_TOKEN,
              },
              signer: expect.any(HttpBearerAuthSigner),
            });
          },
        });
      });
    });

    describe("Operation that uses the specified service `@auth` trait order and `@optionalAuth`", () => {
      test("should resolve to `smithy.api#noAuth` with no config", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.SameAsServiceOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });

      test("should resolve the first auth trait in specified `@auth` trait order (`@httpBearerAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.SameAsServiceOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              Authorization: `Bearer ${MOCK_TOKEN}`,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpBearerAuth",
              },
              identity: {
                token: MOCK_TOKEN,
              },
              signer: expect.any(HttpBearerAuthSigner),
            });
          },
        });
      });

      test("should skip the unsupported codegen `@common#fakeAuth` (before `@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.SameAsServiceOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => {
              throw new Error("after `common#fakeAuth`");
            },
          },
          clientRejects: "after `common#fakeAuth`",
        });
      });

      test("should resolve earlier auth trait given configs (`@httpApiKeyAuth`, `@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.SameAsServiceOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            credentials: async () => MOCK_CREDENTIALS,
          },
          requestMatchers: {
            headers: {
              [MOCK_API_KEY_NAME]: MOCK_API_KEY,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpApiKeyAuth",
                signingProperties: {
                  name: MOCK_API_KEY_NAME,
                  in: HttpApiKeyAuthLocation.HEADER,
                  scheme: undefined,
                },
              },
              identity: {
                apiKey: MOCK_API_KEY,
              },
              signer: expect.any(HttpApiKeyAuthSigner),
            });
          },
        });
      });

      test("should resolve last auth trait (`@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.SameAsServiceOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
          },
          requestMatchers: {
            headers: {
              authorization: (val: any) => expect(val).toBeDefined(),
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "aws.auth#sigv4",
                signingProperties: {
                  name: "weather",
                  region: MOCK_REGION,
                },
                configPropertiesExtractor: expect.anything(),
              },
              identity: MOCK_CREDENTIALS,
              signer: expect.any(SigV4Signer),
            });
          },
        });
      });

      test("should resolve first auth trait (`@httpBearerAuth`) given all auth have configs", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.SameAsServiceOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              Authorization: `Bearer ${MOCK_TOKEN}`,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpBearerAuth",
              },
              identity: {
                token: MOCK_TOKEN,
              },
              signer: expect.any(HttpBearerAuthSigner),
            });
          },
        });
      });
    });

    describe("Operation that specifies the `@auth` trait", () => {
      test("should throw request with no config", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
          clientRejects:
            `HttpAuthScheme \`aws.auth#sigv4\` did not have an IdentityProvider configured.\n` +
            `HttpAuthScheme \`common#fakeAuth\` was not enabled for this service.\n` +
            `HttpAuthScheme \`smithy.api#httpApiKeyAuth\` did not have an IdentityProvider configured.\n` +
            `HttpAuthScheme \`smithy.api#httpBearerAuth\` did not have an IdentityProvider configured.`,
        });
      });

      test("should resolve the first auth trait in specified `@auth` trait order (`@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
          },
          requestMatchers: {
            headers: {
              authorization: (val: any) => expect(val).toBeDefined(),
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "aws.auth#sigv4",
                signingProperties: {
                  name: "weather",
                  region: MOCK_REGION,
                },
                configPropertiesExtractor: expect.anything(),
              },
              identity: MOCK_CREDENTIALS,
              signer: expect.any(SigV4Signer),
            });
          },
        });
      });

      test("should skip the unsupported codegen `@common#fakeAuth` (before `@httpApiKeyAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => {
              throw new Error("after `common#fakeAuth`");
            },
          },
          clientRejects: "after `common#fakeAuth`",
        });
      });

      test("should resolve earlier auth trait given configs (`@httpApiKeyAuth`, `@httpBearerAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              [MOCK_API_KEY_NAME]: MOCK_API_KEY,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpApiKeyAuth",
                signingProperties: {
                  name: MOCK_API_KEY_NAME,
                  in: HttpApiKeyAuthLocation.HEADER,
                  scheme: undefined,
                },
              },
              identity: {
                apiKey: MOCK_API_KEY,
              },
              signer: expect.any(HttpApiKeyAuthSigner),
            });
          },
        });
      });

      test("should resolve last auth trait (`@httpBearerAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              Authorization: `Bearer ${MOCK_TOKEN}`,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpBearerAuth",
              },
              identity: {
                token: MOCK_TOKEN,
              },
              signer: expect.any(HttpBearerAuthSigner),
            });
          },
        });
      });

      test("should resolve first auth trait (`@aws.auth#sigv4`) given all auth have configs", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.OperationAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              authorization: (val: any) => expect(val).toBeDefined(),
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "aws.auth#sigv4",
                signingProperties: {
                  name: "weather",
                  region: MOCK_REGION,
                },
                configPropertiesExtractor: expect.anything(),
              },
              identity: MOCK_CREDENTIALS,
              signer: expect.any(SigV4Signer),
            });
          },
        });
      });
    });

    describe("Operation that specifies the `@auth` trait and `@optionalAuth`", () => {
      test("should resolve to `smithy.api#noAuth` with no config", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });

      test("should resolve the first auth trait in specified `@auth` trait order (`@aws.auth#sigv4`)", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
          },
          requestMatchers: {
            headers: {
              authorization: (val: any) => expect(val).toBeDefined(),
            },
          },
        });
      });

      test("should skip the unsupported codegen `@common#fakeAuth` (before `@httpApiKeyAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => {
              throw new Error("after `common#fakeAuth`");
            },
          },
          clientRejects: "after `common#fakeAuth`",
        });
      });

      test("should resolve earlier auth trait given configs (`@httpApiKeyAuth`, `@httpBearerAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              [MOCK_API_KEY_NAME]: MOCK_API_KEY,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpApiKeyAuth",
                signingProperties: {
                  name: MOCK_API_KEY_NAME,
                  in: HttpApiKeyAuthLocation.HEADER,
                  scheme: undefined,
                },
              },
              identity: {
                apiKey: MOCK_API_KEY,
              },
              signer: expect.any(HttpApiKeyAuthSigner),
            });
          },
        });
      });

      test("should resolve last auth trait (`@httpBearerAuth`)", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              Authorization: `Bearer ${MOCK_TOKEN}`,
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#httpBearerAuth",
              },
              identity: {
                token: MOCK_TOKEN,
              },
              signer: expect.any(HttpBearerAuthSigner),
            });
          },
        });
      });

      test("should resolve first auth trait (`@aws.auth#sigv4`) given all auth have configs", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.OperationAuthTraitOptionalCommand,
          clientConfig: {
            region: MOCK_REGION,
            credentials: async () => MOCK_CREDENTIALS,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
          },
          requestMatchers: {
            headers: {
              authorization: (val: any) => expect(val).toBeDefined(),
            },
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "aws.auth#sigv4",
                signingProperties: {
                  name: "weather",
                  region: MOCK_REGION,
                },
                configPropertiesExtractor: expect.anything(),
              },
              identity: MOCK_CREDENTIALS,
              signer: expect.any(SigV4Signer),
            });
          },
        });
      });
    });

    describe("Operation that uses an empty `@auth` trait", () => {
      test("should resolve to `smithy.api#noAuth` with no config", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.OperationEmptyAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });

      test("should resolve to `smithy.api#noAuth` with config", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.OperationEmptyAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
            credentials: async () => MOCK_CREDENTIALS,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });
    });

    describe("Operation that uses an empty `@auth` trait and `@optionalAuth`", () => {
      test("should resolve to `smithy.api#noAuth` with no config", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.OperationEmptyAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });

      test("should resolve to `smithy.api#noAuth` with config", async () => {
        await expectClientCommand({
          clientConstructor: SpecifiedAuthServiceClient,
          commandConstructor: SAS.OperationEmptyAuthTraitCommand,
          clientConfig: {
            region: MOCK_REGION,
            apiKey: async () => ({
              apiKey: MOCK_API_KEY,
            }),
            token: async () => ({
              token: MOCK_TOKEN,
            }),
            credentials: async () => MOCK_CREDENTIALS,
          },
          contextExpectFn: (context) => {
            expect(getSelectedHttpAuthScheme(context)).toMatchObject({
              httpAuthOption: {
                schemeId: "smithy.api#noAuth",
              },
              identity: {},
              signer: expect.any(NoAuthSigner),
            });
          },
        });
      });
    });
  });
});
