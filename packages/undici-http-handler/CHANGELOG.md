# Change Log

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
