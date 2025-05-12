# Change Log

## 3.3.2

### Patch Changes

- Updated dependencies [103535a]
  - @smithy/middleware-serde@4.0.4

## 3.3.1

### Patch Changes

- 40ffcd5: copy input headers when building RPCv2 CBOR request

## 3.3.0

### Minor Changes

- 5896264: Resolve auth schemes based on the preference list

## 3.2.0

### Minor Changes

- 02ef79c: add numeric value container for serde

### Patch Changes

- Updated dependencies [e917e61]
  - @smithy/protocol-http@5.1.0
  - @smithy/util-stream@4.2.0
  - @smithy/types@4.2.0
  - @smithy/middleware-serde@4.0.3
  - @smithy/util-middleware@4.0.2

## 3.1.5

### Patch Changes

- @smithy/util-stream@4.1.2

## 3.1.4

### Patch Changes

- Updated dependencies [efedb20]
  - @smithy/util-stream@4.1.1

## 3.1.3

### Patch Changes

- Updated dependencies [d1d1f72]
  - @smithy/util-stream@4.1.0

## 3.1.2

### Patch Changes

- Updated dependencies [f5d0bac]
  - @smithy/middleware-serde@4.0.2

## 3.1.1

### Patch Changes

- @smithy/util-stream@4.0.2

## 3.1.0

### Minor Changes

- 2aff9df: Added middleware support to pagination
- 000b2ae: allow paginator token fallback to be specified by operation input

### Patch Changes

- Updated dependencies [2aff9df]
- Updated dependencies [000b2ae]
  - @smithy/types@4.1.0
  - @smithy/middleware-serde@4.0.1
  - @smithy/protocol-http@5.0.1
  - @smithy/util-middleware@4.0.1
  - @smithy/util-stream@4.0.1

## 3.0.0

### Major Changes

- 20d99be: major version bump for dropping node16 support

### Patch Changes

- Updated dependencies [20d99be]
  - @smithy/util-middleware@4.0.0
  - @smithy/util-stream@4.0.0
  - @smithy/util-utf8@4.0.0
  - @smithy/middleware-serde@4.0.0
  - @smithy/protocol-http@5.0.0
  - @smithy/types@4.0.0
  - @smithy/util-body-length-browser@4.0.0

## 2.5.7

### Patch Changes

- @smithy/util-stream@3.3.4

## 2.5.6

### Patch Changes

- @smithy/util-stream@3.3.3

## 2.5.5

### Patch Changes

- Updated dependencies [b52b4e8]
  - @smithy/types@3.7.2
  - @smithy/middleware-serde@3.0.11
  - @smithy/protocol-http@4.1.8
  - @smithy/util-middleware@3.0.11
  - @smithy/util-stream@3.3.2

## 2.5.4

### Patch Changes

- 9c40f7b: make CBOR tags more distinct in JS

## 2.5.3

### Patch Changes

- Updated dependencies [fcd5ca8]
  - @smithy/types@3.7.1
  - @smithy/middleware-serde@3.0.10
  - @smithy/protocol-http@4.1.7
  - @smithy/util-middleware@3.0.10
  - @smithy/util-stream@3.3.1

## 2.5.2

### Patch Changes

- c6ef519: avoid self referencing submodule import
- Updated dependencies [c8d257b]
- Updated dependencies [cd1929b]
  - @smithy/util-stream@3.3.0
  - @smithy/types@3.7.0
  - @smithy/middleware-serde@3.0.9
  - @smithy/protocol-http@4.1.6
  - @smithy/util-middleware@3.0.9

## 2.5.1

### Patch Changes

- Updated dependencies [ccdd49f]
  - @smithy/util-stream@3.2.1

## 2.5.0

### Minor Changes

- 84bec05: add feature identification map to smithy context
- d07b0ab: feature detection for custom endpoint and gzip

### Patch Changes

- d07b0ab: reorganize smithy/core to be upstream of smithy/smithy-client
- Updated dependencies [f4e0bd9]
- Updated dependencies [84bec05]
  - @smithy/util-stream@3.2.0
  - @smithy/types@3.6.0
  - @smithy/middleware-serde@3.0.8
  - @smithy/protocol-http@4.1.5
  - @smithy/util-middleware@3.0.8

## 2.4.8

### Patch Changes

- Updated dependencies [75e0125]
  - @smithy/smithy-client@3.4.0
  - @smithy/middleware-retry@3.0.23

## 2.4.7

### Patch Changes

- Updated dependencies [a4c1285]
  - @smithy/types@3.5.0
  - @smithy/middleware-endpoint@3.1.4
  - @smithy/middleware-retry@3.0.22
  - @smithy/middleware-serde@3.0.7
  - @smithy/protocol-http@4.1.4
  - @smithy/smithy-client@3.3.6
  - @smithy/util-middleware@3.0.7

## 2.4.6

### Patch Changes

- 18dd957: add compatibility types redirect
- Updated dependencies [64600d8]
  - @smithy/smithy-client@3.3.5
  - @smithy/middleware-retry@3.0.21

## 2.4.5

### Patch Changes

- @smithy/smithy-client@3.3.4
- @smithy/middleware-retry@3.0.20

## 2.4.4

### Patch Changes

- @smithy/smithy-client@3.3.3
- @smithy/middleware-retry@3.0.19

## 2.4.3

### Patch Changes

- Updated dependencies [e7b438b]
  - @smithy/types@3.4.2
  - @smithy/middleware-endpoint@3.1.3
  - @smithy/middleware-retry@3.0.18
  - @smithy/middleware-serde@3.0.6
  - @smithy/protocol-http@4.1.3
  - @smithy/smithy-client@3.3.2
  - @smithy/util-middleware@3.0.6

## 2.4.2

### Patch Changes

- Updated dependencies [cf9257e]
  - @smithy/types@3.4.1
  - @smithy/middleware-endpoint@3.1.2
  - @smithy/middleware-retry@3.0.17
  - @smithy/middleware-serde@3.0.5
  - @smithy/protocol-http@4.1.2
  - @smithy/smithy-client@3.3.1
  - @smithy/util-middleware@3.0.5

## 2.4.1

### Patch Changes

- Updated dependencies [c8c53ae]
- Updated dependencies [2dad138]
- Updated dependencies [d8df7bf]
- Updated dependencies [9f3f2f5]
  - @smithy/middleware-endpoint@3.1.1
  - @smithy/types@3.4.0
  - @smithy/smithy-client@3.3.0
  - @smithy/middleware-retry@3.0.16
  - @smithy/middleware-serde@3.0.4
  - @smithy/protocol-http@4.1.1
  - @smithy/util-middleware@3.0.4

## 2.4.0

### Minor Changes

- 5865b65: cbor (de)serializer for JS

### Patch Changes

- Updated dependencies [5865b65]
  - @smithy/smithy-client@3.2.0
  - @smithy/middleware-retry@3.0.15

## 2.3.2

### Patch Changes

- Updated dependencies [670553a]
  - @smithy/smithy-client@3.1.12
  - @smithy/middleware-retry@3.0.14

## 2.3.1

### Patch Changes

- @smithy/smithy-client@3.1.11
- @smithy/middleware-retry@3.0.13

## 2.3.0

### Minor Changes

- 86862ea: switch to static HttpRequest clone method

### Patch Changes

- Updated dependencies [4a40961]
- Updated dependencies [86862ea]
  - @smithy/middleware-endpoint@3.1.0
  - @smithy/protocol-http@4.1.0
  - @smithy/smithy-client@3.1.10
  - @smithy/middleware-retry@3.0.12
  - @smithy/middleware-serde@3.0.3

## 2.2.8

### Patch Changes

- @smithy/smithy-client@3.1.9
- @smithy/middleware-retry@3.0.11

## 2.2.7

### Patch Changes

- Updated dependencies [796567d]
  - @smithy/protocol-http@4.0.4
  - @smithy/middleware-retry@3.0.10
  - @smithy/smithy-client@3.1.8
  - @smithy/middleware-serde@3.0.3

## 2.2.6

### Patch Changes

- @smithy/middleware-endpoint@3.0.5
- @smithy/smithy-client@3.1.7
- @smithy/middleware-retry@3.0.9

## 2.2.5

### Patch Changes

- @smithy/smithy-client@3.1.6
- @smithy/middleware-retry@3.0.8

## 2.2.4

### Patch Changes

- Updated dependencies [4784fb9]
  - @smithy/types@3.3.0
  - @smithy/middleware-endpoint@3.0.4
  - @smithy/middleware-retry@3.0.7
  - @smithy/middleware-serde@3.0.3
  - @smithy/protocol-http@4.0.3
  - @smithy/smithy-client@3.1.5
  - @smithy/util-middleware@3.0.3

## 2.2.3

### Patch Changes

- Updated dependencies [c16e014]
- Updated dependencies [c2a5595]
  - @smithy/types@3.2.0
  - @smithy/middleware-endpoint@3.0.3
  - @smithy/middleware-retry@3.0.6
  - @smithy/middleware-serde@3.0.2
  - @smithy/protocol-http@4.0.2
  - @smithy/smithy-client@3.1.4
  - @smithy/util-middleware@3.0.2

## 2.2.2

### Patch Changes

- @smithy/smithy-client@3.1.3
- @smithy/middleware-retry@3.0.5

## 2.2.1

### Patch Changes

- Updated dependencies [38da9009]
  - @smithy/types@3.1.0
  - @smithy/middleware-endpoint@3.0.2
  - @smithy/middleware-retry@3.0.4
  - @smithy/middleware-serde@3.0.1
  - @smithy/protocol-http@4.0.1
  - @smithy/smithy-client@3.1.2
  - @smithy/util-middleware@3.0.1

## 2.2.0

### Minor Changes

- f9c50081: adds a module exports field in core

## 2.1.1

### Patch Changes

- Updated dependencies [3689c949]
  - @smithy/smithy-client@3.1.1
  - @smithy/middleware-retry@3.0.3

## 2.1.0

### Minor Changes

- ab3a90fa: enable package.json exports in core

### Patch Changes

- Updated dependencies [764047eb]
  - @smithy/smithy-client@3.1.0
  - @smithy/middleware-endpoint@3.0.1
  - @smithy/middleware-retry@3.0.2

## 2.0.1

### Patch Changes

- @smithy/smithy-client@3.0.1
- @smithy/middleware-retry@3.0.1

## 2.0.0

### Major Changes

- 671aa704: update to node16 minimum

### Patch Changes

- Updated dependencies [7a7c84d3]
- Updated dependencies [671aa704]
  - @smithy/types@3.0.0
  - @smithy/middleware-endpoint@3.0.0
  - @smithy/middleware-retry@3.0.0
  - @smithy/middleware-serde@3.0.0
  - @smithy/util-middleware@3.0.0
  - @smithy/protocol-http@4.0.0
  - @smithy/smithy-client@3.0.0

## 1.4.2

### Patch Changes

- Updated dependencies [cc54b8d1]
  - @smithy/middleware-endpoint@2.5.1
  - @smithy/smithy-client@2.5.1
  - @smithy/middleware-retry@2.3.1

## 1.4.1

### Patch Changes

- Updated dependencies [e03a10ac]
  - @smithy/middleware-retry@2.3.0

## 1.4.0

### Minor Changes

- 38f9a61f: Update package dependencies

### Patch Changes

- Updated dependencies [38f9a61f]
- Updated dependencies [661f1d60]
  - @smithy/middleware-endpoint@2.5.0
  - @smithy/middleware-retry@2.2.0
  - @smithy/middleware-serde@2.3.0
  - @smithy/util-middleware@2.2.0
  - @smithy/protocol-http@3.3.0
  - @smithy/smithy-client@2.5.0
  - @smithy/types@2.12.0

## 1.3.8

### Patch Changes

- @smithy/smithy-client@2.4.5
- @smithy/middleware-retry@2.1.7

## 1.3.7

### Patch Changes

- Updated dependencies [32e3f6ff]
  - @smithy/middleware-serde@2.2.1
  - @smithy/middleware-endpoint@2.4.6
  - @smithy/smithy-client@2.4.4
  - @smithy/middleware-retry@2.1.6

## 1.3.6

### Patch Changes

- Updated dependencies [43f3e1e2]
- Updated dependencies [49640d6c]
  - @smithy/middleware-serde@2.2.0
  - @smithy/types@2.11.0
  - @smithy/middleware-endpoint@2.4.5
  - @smithy/middleware-retry@2.1.5
  - @smithy/protocol-http@3.2.2
  - @smithy/smithy-client@2.4.3
  - @smithy/util-middleware@2.1.4

## 1.3.5

### Patch Changes

- @smithy/middleware-endpoint@2.4.4
- @smithy/smithy-client@2.4.2
- @smithy/middleware-retry@2.1.4

## 1.3.4

### Patch Changes

- Updated dependencies [dd0d9b4b]
  - @smithy/middleware-retry@2.1.3
  - @smithy/types@2.10.1
  - @smithy/middleware-endpoint@2.4.3
  - @smithy/middleware-serde@2.1.3
  - @smithy/protocol-http@3.2.1
  - @smithy/smithy-client@2.4.1
  - @smithy/util-middleware@2.1.3

## 1.3.3

### Patch Changes

- Updated dependencies [d70a00ac]
- Updated dependencies [1e23f967]
- Updated dependencies [929801bc]
  - @smithy/types@2.10.0
  - @smithy/protocol-http@3.2.0
  - @smithy/smithy-client@2.4.0
  - @smithy/middleware-endpoint@2.4.2
  - @smithy/middleware-retry@2.1.2
  - @smithy/middleware-serde@2.1.2
  - @smithy/util-middleware@2.1.2

## 1.3.2

### Patch Changes

- 88980bc5: handle multi-part input token in paginator

## 1.3.1

### Patch Changes

- 2b1bf055: generate dist-cjs with runtime list of export names for esm
- Updated dependencies [2b1bf055]
  - @smithy/middleware-endpoint@2.4.1
  - @smithy/middleware-retry@2.1.1
  - @smithy/middleware-serde@2.1.1
  - @smithy/protocol-http@3.1.1
  - @smithy/smithy-client@2.3.1
  - @smithy/types@2.9.1
  - @smithy/util-middleware@2.1.1

## 1.3.0

### Minor Changes

- 9939f823: bundle dist-cjs index

### Patch Changes

- Updated dependencies [9939f823]
  - @smithy/middleware-endpoint@2.4.0
  - @smithy/middleware-retry@2.1.0
  - @smithy/middleware-serde@2.1.0
  - @smithy/util-middleware@2.1.0
  - @smithy/protocol-http@3.1.0
  - @smithy/smithy-client@2.3.0
  - @smithy/types@2.9.0

## 1.2.2

### Patch Changes

- Updated dependencies [590af6b7]
  - @smithy/middleware-endpoint@2.3.0
  - @smithy/types@2.8.0
  - @smithy/smithy-client@2.2.1
  - @smithy/middleware-retry@2.0.26
  - @smithy/middleware-serde@2.0.16
  - @smithy/protocol-http@3.0.12
  - @smithy/util-middleware@2.0.9

## 1.2.1

### Patch Changes

- Updated dependencies [164f3bbd]
- Updated dependencies [164f3bbd]
  - @smithy/smithy-client@2.2.0
  - @smithy/middleware-retry@2.0.25

## 1.2.0

### Minor Changes

- 12adf848: add paginator factory

### Patch Changes

- 3eb09aae: fix(core): strict core deps

## 1.1.0

### Minor Changes

- 75cbb3e8: add requestBuilder

## 1.0.5

### Patch Changes

- @smithy/middleware-endpoint@2.2.3
- @smithy/middleware-retry@2.0.24

## 1.0.4

### Patch Changes

- @smithy/middleware-retry@2.0.23

## 1.0.3

### Patch Changes

- Updated dependencies [44f78bd9]
- Updated dependencies [340634a5]
  - @smithy/middleware-retry@2.0.22
  - @smithy/types@2.7.0
  - @smithy/middleware-endpoint@2.2.2
  - @smithy/middleware-serde@2.0.15
  - @smithy/protocol-http@3.0.11

## 1.0.2

### Patch Changes

- 8c674e70: Copy `getSmithyContext()` and `normalizeProvider()` to `@smithy/core`.
- 9579a9a0: Add internal error and success handlers to `HttpSigner`.
- Updated dependencies [9bfc64ed]
- Updated dependencies [9579a9a0]
  - @smithy/types@2.6.0
  - @smithy/middleware-endpoint@2.2.1
  - @smithy/middleware-retry@2.0.21
  - @smithy/middleware-serde@2.0.14
  - @smithy/protocol-http@3.0.10

## 1.0.1

### Patch Changes

- 4fca874e: Fix test script.

## 1.0.0

### Major Changes

- 8044a814: feat(experimentalIdentityAndAuth): move `experimentalIdentityAndAuth` types and interfaces to `@smithy/types` and `@smithy/core`

### Patch Changes

- Updated dependencies [8044a814]
- Updated dependencies [9e0a5a74]
  - @smithy/middleware-endpoint@2.2.0
  - @smithy/types@2.5.0
  - @smithy/middleware-retry@2.0.20
  - @smithy/middleware-serde@2.0.13
  - @smithy/protocol-http@3.0.9

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.
