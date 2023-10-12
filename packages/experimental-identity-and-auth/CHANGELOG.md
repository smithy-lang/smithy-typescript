# Change Log

## 0.0.18

### Patch Changes

- 49f75b47: Add `@httpBearerAuth` integration tests.
- 56bdadd4: Add strict check for `token` in `HttpBearerAuthSigner`.
- 940aad53: Add `@httpApiKeyAuth` integration tests.
- 3d5da269: Add strict check for `apiKey` in `HttpApiKeyAuthSigner`.
- Updated dependencies [afaa68af]
  - @smithy/middleware-endpoint@2.1.1

## 0.0.17

### Patch Changes

- e5ee17ad: Move `@smithy/util-test` to `devDependencies`.

## 0.0.16

### Patch Changes

- a0957ef1: Fix test script to use `jest`.
- 58824d85: Remove generic parameter defaults.
- 6c53a93b: Add different `httpAuthSchemeMiddleware` plugins depending on `@endpointRuleSet`
- c8c9de77: Await `signer.sign()` in `httpSigningMiddleware`
- d4df615a: Remove extra `# Change Log from `HttpApiKeyAuthSigner`
- f38771a3: Scaffold integration tests.

## 0.0.15

### Patch Changes

- Updated dependencies [f64c4c2d]
  - @smithy/middleware-endpoint@2.1.0

## 0.0.14

### Patch Changes

- Updated dependencies [d6b4c090]
  - @smithy/types@2.3.5
  - @smithy/middleware-endpoint@2.0.11
  - @smithy/middleware-retry@2.0.16
  - @smithy/protocol-http@3.0.7
  - @smithy/signature-v4@2.0.11

## 0.0.13

### Patch Changes

- @smithy/middleware-retry@2.0.15

## 0.0.12

### Patch Changes

- @smithy/middleware-retry@2.0.14

## 0.0.11

### Patch Changes

- 890feeb1: Add aliases for `httpSigningMiddleware`

## 0.0.10

### Patch Changes

- 2503655d: Add `createEndpointRuleSetHttpAuthSchemeParametersProvider()` to generically create `HttpAuthSchemeParametersProvider`s for `@smithy.rules#endpointRuleSet`
- Updated dependencies [2f70f105]
- Updated dependencies [9a562d37]
  - @smithy/types@2.3.4
  - @smithy/middleware-endpoint@2.0.10
  - @smithy/middleware-retry@2.0.13
  - @smithy/protocol-http@3.0.6
  - @smithy/signature-v4@2.0.10

## 0.0.9

### Patch Changes

- 76e2ef3c: Allow `DefaultIdentityProviderConfig` to accept `undefined` in the constructor
- 76e2ef3c: Add `httpAuthSchemeMiddleware` to select an auth scheme
- 76e2ef3c: Add `memoizeIdentityProvider()`
- c346d597: Add `createEndpointRuleSetHttpAuthSchemeProvider()` to generically create `HttpAuthSchemeProvider`s for `@smithy.rules#endpointRuleSet`

## 0.0.8

### Patch Changes

- 85448cbc: Update `HttpAuthSchemeParametersProvider` to take in `input`
- 51b014c8: Add `httpSigningMiddleware` to sign a request based on a selected auth scheme
- Updated dependencies [ea0635d6]
  - @smithy/types@2.3.3
  - @smithy/middleware-retry@2.0.12
  - @smithy/protocol-http@3.0.5
  - @smithy/signature-v4@2.0.9

## 0.0.7

### Patch Changes

- 36d56a1d: Add additional `HttpAuthScheme` interfaces for auth scheme resolution
- Updated dependencies [fbfeebee]
- Updated dependencies [c0b17a13]
  - @smithy/types@2.3.2
  - @smithy/protocol-http@3.0.4
  - @smithy/signature-v4@2.0.8

## 0.0.6

### Patch Changes

- Updated dependencies [b9265813]
- Updated dependencies [6d1c2fb1]
  - @smithy/types@2.3.1
  - @smithy/protocol-http@3.0.3
  - @smithy/signature-v4@2.0.7

## 0.0.5

### Patch Changes

- Updated dependencies [5b3fec37]
  - @smithy/protocol-http@3.0.2
  - @smithy/signature-v4@2.0.6

## 0.0.4

### Patch Changes

- Updated dependencies [5db648a6]
  - @smithy/protocol-http@3.0.1
  - @smithy/signature-v4@2.0.6

## 0.0.3

### Patch Changes

- c6251b7a: INTERNAL USE ONLY: Update `HttpAuthScheme` and `IdentityProviderConfig` interfaces
- Updated dependencies [88bcec3d]
- Updated dependencies [a03026e3]
  - @smithy/types@2.3.0
  - @smithy/protocol-http@3.0.0
  - @smithy/signature-v4@2.0.6

## 0.0.2

### Patch Changes

- 019109d6: INTERNAL USE ONLY: Add `@aws.auth#sigv4` interfaces and classes
- bae9b5de: INTERNAL USE ONLY: Add `@httpApiKeyAuth` interfaces and classes
- 2fc7e78e: INTERNAL USE ONLY: Add `@httpBearerAuth` interfaces and classes

## 0.0.1

### Patch Changes

- 632e7d76: INTERNAL USE ONLY: Add experimental package for `experimentalIdentityAndAuth` types and implementations.

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.
