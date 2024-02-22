# Change Log

## 2.10.0

### Minor Changes

- d70a00ac: allow ctor args in lieu of Agent instances in node-http-handler ctor
- 1e23f967: add socket exhaustion checked warning to node-http-handler

## 2.9.1

### Patch Changes

- 2b1bf055: generate dist-cjs with runtime list of export names for esm

## 2.9.0

### Minor Changes

- 9939f823: bundle dist-cjs index

## 2.8.0

### Minor Changes

- 590af6b7: support credential scope

## 2.7.0

### Minor Changes

- 340634a5: move default fetch and http handler ctor types to the types package

## 2.6.0

### Minor Changes

- 9bfc64ed: add type helper for nullability in clients

### Patch Changes

- 9579a9a0: Add internal error and success handlers to `HttpSigner`.

## 2.5.0

### Minor Changes

- 8044a814: feat(experimentalIdentityAndAuth): move `experimentalIdentityAndAuth` types and interfaces to `@smithy/types` and `@smithy/core`

## 2.4.0

### Minor Changes

- 5e9fd6ce: transform inputs for env specific type helpers

### Patch Changes

- 05f5d42c: Allow lowercase type names for endpoint parameter

## 2.3.5

### Patch Changes

- d6b4c090: Add enum IniSectionType

## 2.3.4

### Patch Changes

- 2f70f105: Support `aliases` for `MiddlewareStack`
- 9a562d37: check for existence of browser Blob/ReadableStream types in payload union

## 2.3.3

### Patch Changes

- ea0635d6: add debug method to middlewareStack

## 2.3.2

### Patch Changes

- fbfeebee: Add `clientName` and `commandName` to `HandlerExecutionContext`
- c0b17a13: Add Smithy context to `HandlerExecutionContext`

## 2.3.1

### Patch Changes

- b9265813: fix: broken ChecksumConfiguration interface in TS < 4.4 and conditional generic types in TS<4.1
- 6d1c2fb1: fix paginator type

## 2.3.0

### Minor Changes

- 88bcec3d: Add retry to runtime extension

## 2.2.2

### Patch Changes

- b753dd4c: move extensions code to smithy-client
- 6c8ffa27: Rename defaultClientConfiguration to defaultExtensionConfiguration

## 2.2.1

### Patch Changes

- 381e03c4: Remove symbol as an index from ChecksumConfiguration interface in @smithy/types

## 2.2.0

### Minor Changes

- f6cb949d: add extensions to client runtime config

## 2.1.0

### Minor Changes

- 59548ba9: Add type to check optional Client Configuration

### Patch Changes

- 3e1ab589: add release tag public to client init interface components

## 2.0.2

### Patch Changes

- 1b951769: custom ts3.4 downlevel for types/transform/type-transform

## 2.0.1

### Patch Changes

- 9d53bc76: update to 2.x major versions

## 1.2.0

### Minor Changes

- e3cbb3cc: set types to the 1.x line

## 2.0.0

### Major Changes

- d90a45b5: improved streaming payload types

### Patch Changes

- 8cd89c75: enable api extractor for documentation generation

## 1.1.1

### Patch Changes

- 6e312329: restore downlevel types

## 1.1.0

### Minor Changes

- adedc001c: Add types for migrated packages

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

See [@aws-sdk/types](https://github.com/aws/aws-sdk-js-v3/blob/main/packages/types/CHANGELOG.md) for additional history.
