# Smithy Typescript Codegen Changelog

## 0.17.0 (2023-07-05)

### Features

* Upgraded to Smithy 1.33.0 [#808](https://github.com/awslabs/smithy-typescript/pull/808))
* Updated enum validator to not remove "internal" tagged members ([#807](https://github.com/awslabs/smithy-typescript/pull/807))

### Bug fixes

* Fixed @aws-smithy/server-common version ([#806](https://github.com/awslabs/smithy-typescript/pull/806))

## 0.16.0 (2023-06-30)

### Features

* Updated code generator to use @smithy scoped npm packages ([#791](https://github.com/awslabs/smithy-typescript/pull/791), [#766](https://github.com/awslabs/smithy-typescript/pull/766))
* Improved blob payload input and output types ([#777](https://github.com/awslabs/smithy-typescript/pull/777))
* Added packageDocumentation and improved interface inheritance ([#770](https://github.com/awslabs/smithy-typescript/pull/770))
* Updated code generator to use runtime-agnostic util-stream package ([#775](https://github.com/awslabs/smithy-typescript/pull/775))

### Bug fixes

* Fixed endpoint parameter name conflict ([#772](https://github.com/awslabs/smithy-typescript/pull/772))
* Stopped trimming collection query param output values ([#764](https://github.com/awslabs/smithy-typescript/pull/764))

## 0.15.0 (2023-05-10)

### Features

* Add Gradle composite build ([#761](https://github.com/awslabs/smithy-typescript/pull/761))
* Improve generated command documentation ([#757](https://github.com/awslabs/smithy-typescript/pull/757))
* Bump SSDK libs version to 1.0.0-alpha.10 ([#738](https://github.com/awslabs/smithy-typescript/pull/738))
* Use aggregated client runtime generator ([#736](https://github.com/awslabs/smithy-typescript/pull/736))
* Add SerdeElision KnowledgeIndex and serde helper function ([#735](https://github.com/awslabs/smithy-typescript/pull/735), [#759](https://github.com/awslabs/smithy-typescript/pull/759))
* Shorten internal serde function names ([#730](https://github.com/awslabs/smithy-typescript/pull/730))
* Reduce generated HTTP request header code ([#729](https://github.com/awslabs/smithy-typescript/pull/729))
* Improve documentation truncation ([#728](https://github.com/awslabs/smithy-typescript/pull/728))
* Export `enum` as `const` to reduce generated code ([#726](https://github.com/awslabs/smithy-typescript/pull/726))
* Add structural hint to commmand examples ([#723](https://github.com/awslabs/smithy-typescript/pull/723))
* Skip generating unused sensitive filter functions ([#722](https://github.com/awslabs/smithy-typescript/pull/722))
* Add DefaultReadmeGenerator ([#721](https://github.com/awslabs/smithy-typescript/pull/721))
* Add TSDocs release tags ([#719](https://github.com/awslabs/smithy-typescript/pull/719))
* Add thrown exceptions to generated command documentation ([#715](https://github.com/awslabs/smithy-typescript/pull/715))
* Remove internal enum values from validation message ([#713](https://github.com/awslabs/smithy-typescript/pull/713))
* Omit aggregated client from paginators ([#712](https://github.com/awslabs/smithy-typescript/pull/712))
* Add NodeJS runtime support to SSDK ([#703](https://github.com/awslabs/smithy-typescript/pull/703))
* Remove reflected values from validation message ([#695](https://github.com/awslabs/smithy-typescript/pull/695))
* Add AddClientRuntimeConfig for generic clients ([#693](https://github.com/awslabs/smithy-typescript/pull/693))

### Bug Fixes

* Fix creating empty model files when chunking ([#714](https://github.com/awslabs/smithy-typescript/pull/714))

## 0.14.0 (2023-02-09)

### Features

* Upgrade TypeScript `lib` to use `es2018` for SSDK libs ([#678](https://github.com/awslabs/smithy-typescript/pull/678))
* Bump SSDK libs version to 1.0.0-alpha.8 ([#689](https://github.com/awslabs/smithy-typescript/pull/689))
* Add a code generator setting to generate `@required` members without `| undefined`. **WARNING**: Using this mode may lead to backwards incompatible impact for clients when a service removes `@required` from a member. ([#566](https://github.com/awslabs/smithy-typescript/pull/566), [#688](https://github.com/awslabs/smithy-typescript/pull/688))

## 0.13.0 (2023-01-31)

### Features

* Upgrade tsconfig.es.json target to ES2020 ([#603](https://github.com/awslabs/smithy-typescript/pull/603))
* Upgrade to Java 17 ([#621](https://github.com/awslabs/smithy-typescript/pull/621))
* Upgrade to node >= 14.0.0 ([#623](https://github.com/awslabs/smithy-typescript/pull/623), [#625](https://github.com/awslabs/smithy-typescript/pull/625), [#628](https://github.com/awslabs/smithy-typescript/pull/628))
* Upgrade to Smithy 1.27.2 ([#682](https://github.com/awslabs/smithy-typescript/pull/682))
* Add mavenCentral as plugin repository ([#629](https://github.com/awslabs/smithy-typescript/pull/629))
* Add intEnum generation with validation and tests ([#605](https://github.com/awslabs/smithy-typescript/pull/605), [#654](https://github.com/awslabs/smithy-typescript/pull/654))
* Use util-base64 instead of platform-based dependencies ([#627](https://github.com/awslabs/smithy-typescript/pull/627), [#631](https://github.com/awslabs/smithy-typescript/pull/631))
* Use util-base8 instead of platform-based dependencies ([#672](https://github.com/awslabs/smithy-typescript/pull/672), [#677](https://github.com/awslabs/smithy-typescript/pull/677))
* Add util-retry dependency ([#650](https://github.com/awslabs/smithy-typescript/pull/650))
* Replace Hash with Checksum ([#668](https://github.com/awslabs/smithy-typescript/pull/668))
* Allow deferred resolution for api key config ([#588](https://github.com/awslabs/smithy-typescript/pull/588))
* Stream improvement serde ([#593](https://github.com/awslabs/smithy-typescript/pull/593))
* Support delegation of determining errors for an operation ([#598](https://github.com/awslabs/smithy-typescript/pull/598))
* Reduce object copying in iterators ([#638](https://github.com/awslabs/smithy-typescript/pull/638))
* Refactor writeAdditionalFiles and writeAdditionalExports logic into integration.customize() ([#607](https://github.com/awslabs/smithy-typescript/pull/607))
* Expose static endpoint param instructions provider ([#590](https://github.com/awslabs/smithy-typescript/pull/590))
* Add unit tests for endpoints v2 generator ([#674](https://github.com/awslabs/smithy-typescript/pull/674))
* Use util-utf8 on server and tests ()
* Bump ssdk lib version to 1.0.0-alpha.7([#675](https://github.com/awslabs/smithy-typescript/pull/675))
* Clients parse datetime offsets ([#681](https://github.com/awslabs/smithy-typescript/pull/681))

### Bug Fixes

* Call parseErrorBody when parsing error structures ([#597](https://github.com/awslabs/smithy-typescript/pull/597))
* Fix broken reference to `fail()` after jest-upgrade ([#645](https://github.com/awslabs/smithy-typescript/pull/645))
* Validate required input query params ([#647](https://github.com/awslabs/smithy-typescript/pull/647), [#646](https://github.com/awslabs/smithy-typescript/pull/646))
* Include x-amz-request-id in request id deser ([#606](https://github.com/awslabs/smithy-typescript/pull/606))
* Add idempotencyToken generation if member is queryParam ([#655](https://github.com/awslabs/smithy-typescript/pull/655))
* Fix Error printout for protocol-response tests ([#657](https://github.com/awslabs/smithy-typescript/pull/657))
* Fix codegen for windows platforms ([#661](https://github.com/awslabs/smithy-typescript/pull/661))
* Fix consistency with type aliases ([#670](https://github.com/awslabs/smithy-typescript/pull/670), [#671](https://github.com/awslabs/smithy-typescript/pull/671))
* Fix misc endpoints 2.0 bugs ([#592](https://github.com/awslabs/smithy-typescript/pull/592), [#600](https://github.com/awslabs/smithy-typescript/pull/600), [#614](https://github.com/awslabs/smithy-typescript/pull/614), [#615](https://github.com/awslabs/smithy-typescript/pull/615), [#616](https://github.com/awslabs/smithy-typescript/pull/616), [#617](https://github.com/awslabs/smithy-typescript/pull/617), [#618](https://github.com/awslabs/smithy-typescript/pull/618), [#619](https://github.com/awslabs/smithy-typescript/pull/619), [#622](https://github.com/awslabs/smithy-typescript/pull/622), [#626](https://github.com/awslabs/smithy-typescript/pull/626), [#634](https://github.com/awslabs/smithy-typescript/pull/634), [#644](https://github.com/awslabs/smithy-typescript/pull/644), [#652](https://github.com/awslabs/smithy-typescript/pull/652), [#658](https://github.com/awslabs/smithy-typescript/pull/658))

## 0.12.0 (2022-09-19)

### Features
* Migrated the code generator to use Smithy's new and recommended DirectedCodegen. ([#585](https://github.com/awslabs/smithy-typescript/pull/585))
* Added support for endpoints v2. ([#586](https://github.com/awslabs/smithy-typescript/pull/586))
* Updated Smithy version to `1.25.x` which bring Smithy IDL v2 support. ([#589](https://github.com/awslabs/smithy-typescript/pull/589))
* Updated SSDK library version to `1.0.0-alpha6`. ([#583](https://github.com/awslabs/smithy-typescript/pull/583))
* Added different package description for client v/s server. ([#582](https://github.com/awslabs/smithy-typescript/pull/582))
* Overrode typescript version for typedoc. ([#561](https://github.com/awslabs/smithy-typescript/pull/561))
* Removed namespaces that only contain log filters. ([#574](https://github.com/awslabs/smithy-typescript/pull/574))
* Added support for event stream for RPC protocols. ([#573](https://github.com/awslabs/smithy-typescript/pull/573))
* Added fallback to status code for unmodeled errors. ([#565](https://github.com/awslabs/smithy-typescript/pull/565))
* Added support for generating protocol specific event payload. ([#554](https://github.com/awslabs/smithy-typescript/pull/554))
* Used Record type instead of Object. ([#556](https://github.com/awslabs/smithy-typescript/pull/556), [#557](https://github.com/awslabs/smithy-typescript/pull/557), [#558](https://github.com/awslabs/smithy-typescript/pull/558), [#562](https://github.com/awslabs/smithy-typescript/pull/562))
* Removed explicit reference to MetadataBearer from error shapes. ([#545](https://github.com/awslabs/smithy-typescript/pull/545))
* Added codegen indicator comment to generated files. ([#538](https://github.com/awslabs/smithy-typescript/pull/538))
* Added check to stop pagination on same token. ([#534](https://github.com/awslabs/smithy-typescript/pull/534))

### Bug Fixes
* Fixed code generation for server protocol tests. ([#577](https://github.com/awslabs/smithy-typescript/pull/577))
* Fixed missing Content-Type header in some events. ([#567](https://github.com/awslabs/smithy-typescript/pull/567))

## 0.11.0 (2022-04-04)

### Features
* Removed MetadataBearer from output type. ([#530](https://github.com/awslabs/smithy-typescript/pull/530))
* Updated Smithy version to `1.19.x`. ([#531](https://github.com/awslabs/smithy-typescript/pull/531))
* Updated `typescript` to `~4.6.2`. ([#527](https://github.com/awslabs/smithy-typescript/pull/527))
* Set bodyLengthChecker type to BodyLengthCalculator. ([#524](https://github.com/awslabs/smithy-typescript/pull/524))

### Bug Fixes
* Added missing export for `httpApiKeyAuth` middleware. ([#528](https://github.com/awslabs/smithy-typescript/pull/528))

## 0.10.0 (2022-03-02)

### Features
* Bumped SSDK library versions to 1.0.0-alpha5. ([#520](https://github.com/awslabs/smithy-typescript/pull/520))
* Added support for `List<String>` in function parameters list. ([#516](https://github.com/awslabs/smithy-typescript/pull/516))
* Updated generation of exceptions for easier handling. ([#502](https://github.com/awslabs/smithy-typescript/pull/502))
* Updated clean script to delete *.tsbuildinfo. ([#514](https://github.com/awslabs/smithy-typescript/pull/514))

### Bug Fixes
* Fixed scripts for npm by extracting run command out. ([#519](https://github.com/awslabs/smithy-typescript/pull/519))
* Fixed the generation of collections of documents in protocol tests. ([#513](https://github.com/awslabs/smithy-typescript/pull/513))

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
