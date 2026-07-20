# Change Log

## 3.0.5

### Patch Changes

- Updated dependencies [3248fbd]
  - @smithy/core@3.29.6

## 3.0.4

### Patch Changes

- Updated dependencies [b44cb0a]
  - @smithy/core@3.29.5

## 3.0.3

### Patch Changes

- Updated dependencies [5fca3a0]
  - @smithy/core@3.29.4

## 3.0.2

### Patch Changes

- Updated dependencies [a97abc3]
  - @smithy/types@4.16.1
  - @smithy/core@3.29.3

## 3.0.1

### Patch Changes

- 273e480: types updates for isolatedModules=true
- Updated dependencies [273e480]
- Updated dependencies [74b3d45]
  - @smithy/types@4.16.0
  - @smithy/core@3.29.2

## 3.0.0

### Major Changes

- 6076716: HTTP/2 is no longer enabled by default. Set `allowH2: true` in your dispatcher options to opt in to HTTP/2 negotiation via ALPN.
- 4b6b90a: Use the undici global dispatcher as the default fallback when no custom `Agent` options are provided. This respects environment-level proxy/TLS configuration set via `setGlobalDispatcher` without creating a redundant `Agent` instance.

## 2.2.5

### Patch Changes

- Updated dependencies [1fac409]
  - @smithy/core@3.29.1

## 2.2.4

### Patch Changes

- Updated dependencies [12bceb2]
- Updated dependencies [4395dad]
  - @smithy/core@3.29.0
  - @smithy/types@4.15.1

## 2.2.3

### Patch Changes

- Updated dependencies [d366537]
- Updated dependencies [c0d7f5d]
  - @smithy/core@3.28.0

## 2.2.2

### Patch Changes

- Updated dependencies [c9575e1]
- Updated dependencies [2dcefdb]
- Updated dependencies [91280a5]
  - @smithy/core@3.27.0

## 2.2.1

### Patch Changes

- Updated dependencies [3cfda3b]
  - @smithy/core@3.26.0

## 2.2.0

### Minor Changes

- b5a960e: Route event streams through the shared dispatcher instead of a dedicated isolated Client

### Patch Changes

- Updated dependencies [63ddca4]
  - @smithy/core@3.25.1

## 2.1.2

### Patch Changes

- 4ed3b90: Document that a single-origin undici `Client` dispatcher must not be used with an SDK client whose operations may route to multiple hosts

## 2.1.1

### Patch Changes

- 5ddf7a2: Add a "Migrating from NodeHttp2Handler" section to the undici-http-handler README that maps each NodeHttp2Handler option to its undici Dispatcher equivalent, with a before/after example.

## 2.1.0

### Minor Changes

- 17e50e9: update dist-cjs output format to use plain require/exports statements

### Patch Changes

- Updated dependencies [17e50e9]
  - @smithy/types@4.15.0
  - @smithy/core@3.25.0

## 2.0.3

### Patch Changes

- af4381b: Add Client dispatcher benchmark
- 1e5bdd3: Update author URL in package.json to be more specific
- bcbadbc: package json updates
- Updated dependencies [1e5bdd3]
- Updated dependencies [13e74d6]
- Updated dependencies [3bc3322]
- Updated dependencies [bcbadbc]
  - @smithy/core@3.24.7
  - @smithy/types@4.14.4

## 2.0.2

### Patch Changes

- 4a0a6a1: Add a "Migrating from NodeHttpHandler" section to the undici-http-handler README that maps each NodeHttpHandler option to its undici Dispatcher equivalent, with a before/after example.

## 2.0.1

### Patch Changes

- Updated dependencies [776bc52]
- Updated dependencies [5b92a54]
  - @smithy/types@4.14.3
  - @smithy/core@3.24.6

## 2.0.0

### Major Changes

- 8644700: Bump undici to 7.x. This drops support for node 18 too.

## 1.0.5

### Patch Changes

- Updated dependencies [721fbed]
  - @smithy/core@3.24.5

## 1.0.4

### Patch Changes

- dcd1356: Preserve AbortSignal.reason on aborted requests

## 1.0.3

### Patch Changes

- 5952e20: Honor caller dispatcher for event streams
- 931420e: Skip compiling test files
- 5c2c13b: Require close/destroy in isDispatcher duck-type check

## 1.0.2

### Patch Changes

- e6a40c5: Document that passing a user-owned Dispatcher lets the application pin a newer undici than the one bundled with the handler, picking up upstream performance improvements (HTTP parser, connection pooling, etc.).
- 821dac8: Remove note about dispatcher destroy on cleanup
- Updated dependencies [9eaa5c6]
  - @smithy/core@3.24.4

## 1.0.1

### Patch Changes

- 2785e2a: A dummy change for automated patch release, which fixes installation issue

## 1.0.0

### Major Changes

- 89d9730: Add HttpHandler backed by Node.js undici

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

See [@smithy/undici-http-handler](https://github.com/smithy/smithy-typescript/blob/main/packages/undici-http-handler/CHANGELOG.md) for additional history.
