# Changelog

## 0.4.0

### Minor Changes

- b3958ad: event stream support for schema-based server SDK

### Patch Changes

- d774f8d: chore: build packages with typescript 7. Packages continue to be compatible with TypeScript 3.4 through 7.0 in consumer applications.
- Updated dependencies [b3958ad]
- Updated dependencies [d774f8d]
  - @smithy/core@3.33.1
  - @smithy/types@4.17.1

## 0.3.1

### Patch Changes

- 27295ea: update readmes for server packages

## 0.3.0

### Minor Changes

- ec9b4b2: chore: update builds to use typescript 6. This should not affect consumers, who may continue to use TypeScript 3.4 through 7.0 as of this version.

### Patch Changes

- Updated dependencies [ec9b4b2]
  - @smithy/types@4.17.0
  - @smithy/core@3.32.0

## 0.2.0

### Minor Changes

- 008d164: add additional protocol options to schema-based server handler
- 761267d: update ServerProtocol interfaces
- e3172c6: chore to bring @smithy/server-\* packages into repo standards
- bb4c289: make SchemaServiceHandler directly instantiable without a generated extending class

## 0.1.6

### Patch Changes

- Updated dependencies [fcf1366]
  - @smithy/core@3.31.1
  - @smithy/protocol-http@5.5.16

## 0.1.5

### Patch Changes

- Updated dependencies [a14bb71]
  - @smithy/core@3.31.0
  - @smithy/protocol-http@5.5.15

## 0.1.4

### Patch Changes

- Updated dependencies [54040ef]
- Updated dependencies [155bb56]
  - @smithy/core@3.30.0
  - @smithy/protocol-http@5.5.14

## 0.1.3

### Patch Changes

- Updated dependencies [d6e6f8b]
  - @smithy/core@3.29.8
  - @smithy/protocol-http@5.5.13

## 0.1.2

### Patch Changes

- Updated dependencies [44b21e6]
  - @smithy/core@3.29.7
  - @smithy/protocol-http@5.5.12

## 0.1.1

### Patch Changes

- 3c08e0b: Publish server packages through changesets

## 0.1.0 (2026-07-20)

### Features

- Renamed package from `@aws-smithy/server-common` to `@smithy/server-common`. ([#2156](https://github.com/smithy-lang/smithy-typescript/pull/2156))
