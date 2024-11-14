# Change Log

## 4.1.1

### Patch Changes

- Updated dependencies [fcd5ca8]
  - @smithy/types@3.7.1
  - @smithy/protocol-http@4.1.7
  - @smithy/querystring-builder@3.0.10

## 4.1.0

### Minor Changes

- cd1929b: vitest compatibility

### Patch Changes

- Updated dependencies [cd1929b]
  - @smithy/types@3.7.0
  - @smithy/protocol-http@4.1.6
  - @smithy/querystring-builder@3.0.9

## 4.0.0

### Major Changes

- c257049: replace FileReader with Blob.arrayBuffer() where possible

### Patch Changes

- Updated dependencies [84bec05]
  - @smithy/types@3.6.0
  - @smithy/protocol-http@4.1.5
  - @smithy/querystring-builder@3.0.8

## 3.2.9

### Patch Changes

- Updated dependencies [a4c1285]
  - @smithy/types@3.5.0
  - @smithy/protocol-http@4.1.4
  - @smithy/querystring-builder@3.0.7

## 3.2.8

### Patch Changes

- 0d5ab1d: Omit setting cache setting on request init when using default value

## 3.2.7

### Patch Changes

- Updated dependencies [e7b438b]
  - @smithy/types@3.4.2
  - @smithy/protocol-http@4.1.3
  - @smithy/querystring-builder@3.0.6

## 3.2.6

### Patch Changes

- cf9257e: add requestInit options to fetch
- Updated dependencies [cf9257e]
  - @smithy/types@3.4.1
  - @smithy/protocol-http@4.1.2
  - @smithy/querystring-builder@3.0.5

## 3.2.5

### Patch Changes

- Updated dependencies [2dad138]
- Updated dependencies [9f3f2f5]
  - @smithy/types@3.4.0
  - @smithy/protocol-http@4.1.1
  - @smithy/querystring-builder@3.0.4

## 3.2.4

### Patch Changes

- 3ea4789: Initialize removeSignalEventListener as an empty function

## 3.2.3

### Patch Changes

- Updated dependencies [86862ea]
  - @smithy/protocol-http@4.1.0

## 3.2.2

### Patch Changes

- Updated dependencies [796567d]
  - @smithy/protocol-http@4.0.4

## 3.2.1

### Patch Changes

- f31cc5f: remove abort signal event listeners after request completion

## 3.2.0

### Minor Changes

- 4784fb9: Adding support for setting the fetch API credentials mode

### Patch Changes

- Updated dependencies [4784fb9]
  - @smithy/types@3.3.0
  - @smithy/protocol-http@4.0.3
  - @smithy/querystring-builder@3.0.3

## 3.1.0

### Minor Changes

- c2a5595: use platform AbortController|AbortSignal implementations

### Patch Changes

- Updated dependencies [c16e014]
- Updated dependencies [c2a5595]
  - @smithy/types@3.2.0
  - @smithy/protocol-http@4.0.2
  - @smithy/querystring-builder@3.0.2

## 3.0.3

### Patch Changes

- fedce37: move keepAliveSupport check to FetchHttpHandler constructor

## 3.0.2

### Patch Changes

- Updated dependencies [38da9009]
  - @smithy/types@3.1.0
  - @smithy/protocol-http@4.0.1
  - @smithy/querystring-builder@3.0.1

## 3.0.1

### Patch Changes

- cc9fa00e: set duplex on fetch options

## 3.0.0

### Major Changes

- 671aa704: update to node16 minimum

### Patch Changes

- e76e736b: improve stream collection speed
- Updated dependencies [7a7c84d3]
- Updated dependencies [671aa704]
  - @smithy/types@3.0.0
  - @smithy/querystring-builder@3.0.0
  - @smithy/protocol-http@4.0.0
  - @smithy/util-base64@3.0.0

## 2.5.0

### Minor Changes

- 38f9a61f: Update package dependencies

### Patch Changes

- Updated dependencies [38f9a61f]
- Updated dependencies [661f1d60]
  - @smithy/querystring-builder@2.2.0
  - @smithy/protocol-http@3.3.0
  - @smithy/util-base64@2.3.0
  - @smithy/types@2.12.0

## 2.4.5

### Patch Changes

- Updated dependencies [8e8f3513]
  - @smithy/util-base64@2.2.1

## 2.4.4

### Patch Changes

- Updated dependencies [43f3e1e2]
  - @smithy/util-base64@2.2.0
  - @smithy/types@2.11.0
  - @smithy/protocol-http@3.2.2
  - @smithy/querystring-builder@2.1.4

## 2.4.3

### Patch Changes

- Updated dependencies [dd0d9b4b]
  - @smithy/types@2.10.1
  - @smithy/protocol-http@3.2.1
  - @smithy/querystring-builder@2.1.3

## 2.4.2

### Patch Changes

- Updated dependencies [d70a00ac]
- Updated dependencies [1e23f967]
- Updated dependencies [929801bc]
  - @smithy/types@2.10.0
  - @smithy/protocol-http@3.2.0
  - @smithy/querystring-builder@2.1.2

## 2.4.1

### Patch Changes

- 2b1bf055: generate dist-cjs with runtime list of export names for esm
- Updated dependencies [2b1bf055]
  - @smithy/protocol-http@3.1.1
  - @smithy/querystring-builder@2.1.1
  - @smithy/types@2.9.1
  - @smithy/util-base64@2.1.1

## 2.4.0

### Minor Changes

- 9939f823: bundle dist-cjs index

### Patch Changes

- Updated dependencies [9939f823]
  - @smithy/querystring-builder@2.1.0
  - @smithy/protocol-http@3.1.0
  - @smithy/util-base64@2.1.0
  - @smithy/types@2.9.0

## 2.3.2

### Patch Changes

- Updated dependencies [590af6b7]
  - @smithy/types@2.8.0
  - @smithy/protocol-http@3.0.12
  - @smithy/querystring-builder@2.0.16

## 2.3.1

### Patch Changes

- e2e3f7d5: align ctor and static creation signatures for http handlers

## 2.3.0

### Minor Changes

- 340634a5: move default fetch and http handler ctor types to the types package

### Patch Changes

- Updated dependencies [340634a5]
  - @smithy/types@2.7.0
  - @smithy/protocol-http@3.0.11
  - @smithy/querystring-builder@2.0.15

## 2.2.7

### Patch Changes

- Updated dependencies [9bfc64ed]
- Updated dependencies [9579a9a0]
  - @smithy/types@2.6.0
  - @smithy/protocol-http@3.0.10
  - @smithy/querystring-builder@2.0.14

## 2.2.6

### Patch Changes

- Updated dependencies [8044a814]
  - @smithy/types@2.5.0
  - @smithy/protocol-http@3.0.9
  - @smithy/querystring-builder@2.0.13

## 2.2.5

### Patch Changes

- Updated dependencies [5598a033]
  - @smithy/util-base64@2.0.1

## 2.2.4

### Patch Changes

- Updated dependencies [5e9fd6ce]
- Updated dependencies [05f5d42c]
  - @smithy/types@2.4.0
  - @smithy/protocol-http@3.0.8
  - @smithy/querystring-builder@2.0.12

## 2.2.3

### Patch Changes

- 34b7f7b6: set keepalive default to false in fetch handler

## 2.2.2

### Patch Changes

- Updated dependencies [d6b4c090]
  - @smithy/types@2.3.5
  - @smithy/protocol-http@3.0.7
  - @smithy/querystring-builder@2.0.11

## 2.2.1

### Patch Changes

- b411ffd1: use valid dummy URL

## 2.2.0

### Minor Changes

- 4528c37d: add fetch http handler keepAlive option

### Patch Changes

- Updated dependencies [2f70f105]
- Updated dependencies [9a562d37]
  - @smithy/types@2.3.4
  - @smithy/protocol-http@3.0.6
  - @smithy/querystring-builder@2.0.10

## 2.1.5

### Patch Changes

- Updated dependencies [ea0635d6]
  - @smithy/types@2.3.3
  - @smithy/protocol-http@3.0.5
  - @smithy/querystring-builder@2.0.9

## 2.1.4

### Patch Changes

- Updated dependencies [fbfeebee]
- Updated dependencies [c0b17a13]
  - @smithy/types@2.3.2
  - @smithy/protocol-http@3.0.4
  - @smithy/querystring-builder@2.0.8

## 2.1.3

### Patch Changes

- Updated dependencies [b9265813]
- Updated dependencies [6d1c2fb1]
  - @smithy/types@2.3.1
  - @smithy/protocol-http@3.0.3
  - @smithy/querystring-builder@2.0.7

## 2.1.2

### Patch Changes

- Updated dependencies [5b3fec37]
  - @smithy/protocol-http@3.0.2

## 2.1.1

### Patch Changes

- Updated dependencies [5db648a6]
  - @smithy/protocol-http@3.0.1

## 2.1.0

### Minor Changes

- a03026e3: Add http client component to runtime extension

### Patch Changes

- Updated dependencies [88bcec3d]
- Updated dependencies [a03026e3]
  - @smithy/types@2.3.0
  - @smithy/protocol-http@3.0.0
  - @smithy/querystring-builder@2.0.6

## 2.0.5

### Patch Changes

- Updated dependencies [b753dd4c]
- Updated dependencies [6c8ffa27]
  - @smithy/types@2.2.2
  - @smithy/protocol-http@2.0.5
  - @smithy/querystring-builder@2.0.5

## 2.0.4

### Patch Changes

- Updated dependencies [381e03c4]
  - @smithy/types@2.2.1
  - @smithy/protocol-http@2.0.4
  - @smithy/querystring-builder@2.0.4

## 2.0.3

### Patch Changes

- Updated dependencies [f6cb949d]
  - @smithy/types@2.2.0
  - @smithy/protocol-http@2.0.3
  - @smithy/querystring-builder@2.0.3

## 2.0.2

### Patch Changes

- Updated dependencies [59548ba9]
- Updated dependencies [3e1ab589]
  - @smithy/types@2.1.0
  - @smithy/protocol-http@2.0.2
  - @smithy/querystring-builder@2.0.2

## 2.0.1

### Patch Changes

- Updated dependencies [1b951769]
  - @smithy/types@2.0.2
  - @smithy/protocol-http@2.0.1
  - @smithy/querystring-builder@2.0.1

## 2.0.0

### Major Changes

- 9d53bc76: update to 2.x major versions

### Patch Changes

- Updated dependencies [9d53bc76]
  - @smithy/protocol-http@2.0.0
  - @smithy/querystring-builder@2.0.0
  - @smithy/util-base64@2.0.0
  - @smithy/types@2.0.1

## 1.1.0

### Minor Changes

- e3cbb3cc: set types to the 1.x line

### Patch Changes

- Updated dependencies [e3cbb3cc]
  - @smithy/protocol-http@1.2.0
  - @smithy/querystring-builder@1.1.0
  - @smithy/types@1.2.0
  - @smithy/util-base64@1.1.0

## 1.0.3

### Patch Changes

- 99d00e98: Bump webpack to 5.76.0
- Updated dependencies [8cd89c75]
- Updated dependencies [d90a45b5]
  - @smithy/types@2.0.0
  - @smithy/protocol-http@1.1.2
  - @smithy/querystring-builder@1.0.3

## 1.0.2

### Patch Changes

- 6e312329: restore downlevel types
- Updated dependencies [6e312329]
  - @smithy/querystring-builder@1.0.2
  - @smithy/protocol-http@1.1.1
  - @smithy/util-base64@1.0.2
  - @smithy/types@1.1.1

## 1.0.1

### Patch Changes

- 2c57033f: Set correct publishConfig directory
- Updated dependencies [2c57033f]
  - @smithy/querystring-builder@1.0.1
  - @smithy/util-base64@1.0.1

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

See [@aws-sdk/fetch-http-handler](https://github.com/aws/aws-sdk-js-v3/blob/main/packages/fetch-http-handler/CHANGELOG.md) for additional history.
