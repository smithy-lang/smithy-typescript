# Smithy Typescript Codegen Changelog

## 0.9.0 (2022-02-14)

### Features
* Updated Smithy version to `1.17.x`. ([#505](https://github.com/awslabs/smithy-typescript/pull/505))
* Added support for `@httpApiKeyAuth`. ([#473](https://github.com/awslabs/smithy-typescript/pull/473))
* Added a default `prepack` script to generated packages. ([#479](https://github.com/awslabs/smithy-typescript/pull/479))
* Added TypeScript contextual keywords to the reserved words list.
  ([#500](https://github.com/awslabs/smithy-typescript/pull/500))
* Changed generated builds to run concurrently. ([#498](https://github.com/awslabs/smithy-typescript/pull/498))
* Added support for `defaultsMode`. ([#495](https://github.com/awslabs/smithy-typescript/pull/495))
* Updated generated packages to use `@tsconfig/recommended`.
  ([#493](https://github.com/awslabs/smithy-typescript/pull/493))
* Removed `filterSensitiveLog` from exceptions. ([#488](https://github.com/awslabs/smithy-typescript/pull/488))
* Bumped SSDK library versions to 1.0.0-alpha4. ([#480](https://github.com/awslabs/smithy-typescript/pull/480))
* Removed test dependencies and configuration from generated packages.
  ([#483](https://github.com/awslabs/smithy-typescript/pull/483))
* Updated minimum supported Node version to 12.
  ([#481](https://github.com/awslabs/smithy-typescript/pull/481),
   [#482](https://github.com/awslabs/smithy-typescript/pull/482))
* Added option to configure package manager, supporting `yarn` and `npm`.
  ([#476](https://github.com/awslabs/smithy-typescript/pull/476))
* Switched pattern validation to re2-wasm to avoid native dependency.
  ([#467](https://github.com/awslabs/smithy-typescript/pull/467))

### Bug Fixes
* Updated protocol tests to check for `ErrorName`. ([#490](https://github.com/awslabs/smithy-typescript/pull/490))
* Added escaping for regex literals in path segments. ([#477](https://github.com/awslabs/smithy-typescript/pull/477))
* Fix greedy label matching. ([#474](https://github.com/awslabs/smithy-typescript/pull/474))

### Documentation
* Updated README example. ([#501](https://github.com/awslabs/smithy-typescript/pull/501))

## 0.8.0 (2021-11-23)

### Features

* Updated Smithy version dependency to be more specific. ([#465](https://github.com/awslabs/smithy-typescript/pull/465))
* Updated Smithy version to `1.14.x`. ([#468](https://github.com/awslabs/smithy-typescript/pull/468))

### Bug Fixes

* Fixed the generated comment for link to client config. ([#466](https://github.com/awslabs/smithy-typescript/pull/466))

## 0.7.0 (2021-11-03)

### Features

* Updated parsing of timestamps and unions to be stricter. ([#412](https://github.com/awslabs/smithy-typescript/pull/412), [#414](https://github.com/awslabs/smithy-typescript/pull/414))
* Reduced published package size. ([#427](https://github.com/awslabs/smithy-typescript/pull/427), [#443](https://github.com/awslabs/smithy-typescript/pull/443), [#446](https://github.com/awslabs/smithy-typescript/pull/446), [#444](https://github.com/awslabs/smithy-typescript/pull/444), [#452](https://github.com/awslabs/smithy-typescript/pull/452))
* Added handling for more complex Accept header values. ([#431](https://github.com/awslabs/smithy-typescript/pull/431))
* Moved source files to `src` folder. ([#434](https://github.com/awslabs/smithy-typescript/pull/434), [#437](https://github.com/awslabs/smithy-typescript/pull/437), [#438](https://github.com/awslabs/smithy-typescript/pull/438))
* Added ability to ts-ignore a default import. ([#445](https://github.com/awslabs/smithy-typescript/pull/445))
* Updated Smithy version to `1.12.0`. ([#448](https://github.com/awslabs/smithy-typescript/pull/448))
* Switched to re2 for pattern validation. ([#451](https://github.com/awslabs/smithy-typescript/pull/451))

### Bug Fixes

* Used base64 en/decoder from context in bindings. ([#419](https://github.com/awslabs/smithy-typescript/pull/419))
* Downgraded `typescript` to `~4.3.5`. ([#418](https://github.com/awslabs/smithy-typescript/pull/418))
* Fixed XML protocol test to compare payload with outmost node. ([#433](https://github.com/awslabs/smithy-typescript/pull/433))
* Fixed handling of multi-value query parameters to align with API Gateway behavior. ([#449](https://github.com/awslabs/smithy-typescript/pull/449))

## 0.6.0 (2021-09-02)

### Features

* Updated parsing of request and response payloads for Http binding protocols to be stricter. ([#405](https://github.com/awslabs/smithy-typescript/pull/405))
* Updated number parsing to be stricter based on size. ([#397](https://github.com/awslabs/smithy-typescript/pull/397), [#404](https://github.com/awslabs/smithy-typescript/pull/404))
* Added handling for Content-Type and Accept headers in SSDK. ([#394](https://github.com/awslabs/smithy-typescript/pull/394))
* Added a generator for `@httpMalformedRequestTests`. ([#393](https://github.com/awslabs/smithy-typescript/pull/393))
* Added warning for unsupported Node.js version. ([#392](https://github.com/awslabs/smithy-typescript/pull/392))

### Bug Fixes

* Allowed setting prefix path for rpc protocols. ([#406](https://github.com/awslabs/smithy-typescript/pull/406))
* Fixed SSDK codegen for different casing of operation name, by using operation symbol name consistently. ([#402](https://github.com/awslabs/smithy-typescript/pull/402))
* Fixed processing of runtime config for generic clients. ([#401](https://github.com/awslabs/smithy-typescript/pull/401))

## 0.5.0 (2021-07-23)

### Features

* Bumped `tslib` version to `2.3.0`. ([#387](https://github.com/awslabs/smithy-typescript/pull/387))
* Calculate content-length for SSDKs. ([#386](https://github.com/awslabs/smithy-typescript/pull/386))

### Bug Fixes

* Update dependency versioning to pull from `smithy-aws-typescript-codegen` or use `latest`. ([#388](https://github.com/awslabs/smithy-typescript/pull/388))
