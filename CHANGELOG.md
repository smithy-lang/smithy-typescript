# Smithy Typescript Codegen Changelog

## 0.28.0 (2025-04-01)

### Bug Fixes
- Used backticks for example strings containing doublequotes ([#1556](https://github.com/smithy-lang/smithy-typescript/pull/1556))
- Generated client.initConfig reference for tracking config object custody ([#1550](https://github.com/smithy-lang/smithy-typescript/pull/1550))
- Used generic type for client config ([#1549](https://github.com/smithy-lang/smithy-typescript/pull/1549))
- Allowed authscheme resolver to access client ref ([#1548](https://github.com/smithy-lang/smithy-typescript/pull/1548))

### Documentation
- Added doc examples to operations ([#1078](https://github.com/smithy-lang/smithy-typescript/pull/1078))
- Replaced GitHub org from 'awslabs' to 'smithy-lang' ([#1545](https://github.com/smithy-lang/smithy-typescript/pull/1545))

## 0.27.0 (2025-03-04)

### Features
- Support MultiSelect List in OperationContextParams ([#1536](https://github.com/smithy-lang/smithy-typescript/pull/1536))
- Support MultiSelect Flatten in OperationContextParams ([#1537](https://github.com/smithy-lang/smithy-typescript/pull/1537))
- Upgrade smithy version to 1.53.0 ([#1538](https://github.com/smithy-lang/smithy-typescript/pull/1538))
- Upgrade smithy version to 1.54.0 ([#1540](https://github.com/smithy-lang/smithy-typescript/pull/1540))

### Bug Fixes
- Fixed union member serialization in CBOR ([#1526](https://github.com/smithy-lang/smithy-typescript/pull/1526))
- Fixed allocation of strings starting with underscore and other cases ([#1527](https://github.com/smithy-lang/smithy-typescript/pull/1527))

### Documentation
- Moved description block before deprecated tag ([#1516](https://github.com/smithy-lang/smithy-typescript/pull/1516))

## 0.26.0 (2025-01-22)

### Features
- Dropped support for Node.js 16 ([#1487](https://github.com/smithy-lang/smithy-typescript/pull/1487))
- Upgraded smithyGradleVersion to 1.2.0 ([#1499](https://github.com/smithy-lang/smithy-typescript/pull/1499))
- Passed client configuration to loadNodeConfig calls ([#1471](https://github.com/smithy-lang/smithy-typescript/pull/1471))
- Removed String extension in LazyJsonString ([#1468](https://github.com/smithy-lang/smithy-typescript/pull/1468))
- Upgraded vitest to 2.1.8 ([#1496](https://github.com/smithy-lang/smithy-typescript/pull/1496))

### Bug Fixes
- Fixed code generation issue for operationContextParam ([#1475](https://github.com/smithy-lang/smithy-typescript/pull/1475))
- Resolved obj and array JS literals from JMESPath types for waiters ([#1462](https://github.com/smithy-lang/smithy-typescript/pull/1462))

## 0.25.0 (2024-11-18)

### Features
- Upgraded smithyVersion to 1.52.0 ([#1434](https://github.com/smithy-lang/smithy-typescript/pull/1434))
- Added default accepts=application/cbor header for Smithy RPC v2 CBOR protocol ([#1427](https://github.com/smithy-lang/smithy-typescript/pull/1427))
- Added `| undefined` for optional type properties to support `exactOptionalPropertyTypes` ([#1448](https://github.com/smithy-lang/smithy-typescript/pull/1448))

### Bug Fixes
- Added uuid types import when adding uuid import ([#1428](https://github.com/smithy-lang/smithy-typescript/pull/1428))


## 0.24.0 (2024-09-30)

### Features

* Use spread operator for Command endpoint params only when necessary ([#1396](https://github.com/smithy-lang/smithy-typescript/pull/1396))
* Improve IDE type navigation assistance for command classes ([#1373](https://github.com/smithy-lang/smithy-typescript/pull/1373))

### Bug Fixes

* Allow empty string field values for headers ([#1412](https://github.com/smithy-lang/smithy-typescript/pull/1412))

## 0.23.0 (2024-09-09)

### Features

- codegen: Added Smithy RPCv2 CBOR protocol generator ([#1280](https://github.com/smithy-lang/smithy-typescript/pull/1280))

- codegen: Added support for string array parameters in endpoints ([#1376](https://github.com/smithy-lang/smithy-typescript/pull/1376))

- codegen: Added support for operation context params in endpoints ([#1379](https://github.com/smithy-lang/smithy-typescript/pull/1379))

### Bug Fixes

- Added logic to resolve the service specific endpoint once per client instance instead of for each request ([#1382](https://github.com/smithy-lang/smithy-typescript/pull/1382))

- Fixed a bug that prevented a concrete client type (e.g., `S3Client`) to be converted to a `NodeJsClient` ([#1389](https://github.com/smithy-lang/smithy-typescript/pull/1389))


### Documentation

## 0.22.0 (2024-08-06)

### Features

- codegen: Enabled the new identity and auth behavior by default and add a legacy auth mode ([#1352](https://github.com/smithy-lang/smithy-typescript/pull/1352))

- codegen: Added logic to skip the application of the `CustomEndpoints` plugin for models using Endpoints-2.0 ([#1337](https://github.com/smithy-lang/smithy-typescript/pull/1337))

- codegen: Added automatic default idempotency tokens in headers for requests when a token is not explicitly provided ([#1327](https://github.com/smithy-lang/smithy-typescript/pull/1327))

- codegen: Added a set of built-in integration plugins to code-generator ([#1321](https://github.com/smithy-lang/smithy-typescript/pull/1321))

### Bug Fixes

- codegen: Fixed inconsistent ordering issue when writing client params during code-generation ([#1355](https://github.com/smithy-lang/smithy-typescript/pull/1355))

- codegen: Fixed incorrect usage of string templates when generating commands ([#1354](https://github.com/smithy-lang/smithy-typescript/pull/1354))

- codegen: Fixed serialization of `:event-type` in event-streams where the member target-id was being used instead of the member name ([#1349](https://github.com/smithy-lang/smithy-typescript/pull/1349))

- codegen: Fixed issue where content-type was being set when input body was empty ([#1304](https://github.com/smithy-lang/smithy-typescript/pull/1304))

## 0.21.1 (2024-06-05)

### Features

- Added logging for `CredentialsProviderError` ([#1290](https://github.com/smithy-lang/smithy-typescript/pull/1290))

### Bug Fixes

- Fixed issues with serializing millisecond precision timestamps for certain formats ([#1289](https://github.com/smithy-lang/smithy-typescript/pull/1289),
  [#1295](https://github.com/smithy-lang/smithy-typescript/pull/1295))
- Fixed issue where `export` was used instead of the clearer `export type` ([#1284](https://github.com/smithy-lang/smithy-typescript/pull/1284))

## 0.21.0 (2024-05-22)

### Breaking Changes

- Update Engines to Node.js 16, Node.js 14 is not officialy supported anymore  ([#1258](https://github.com/smithy-lang/smithy-typescript/pull/1258))

### Features

- Bumped TypeScript to ~5.2.x in smithy JS packages ([#1275](https://github.com/smithy-lang/smithy-typescript/pull/1275))
- `@smithy/fetch-http-handler`, `@smithy/node-http-handler`: Improveed stream collection performance ([#1272](https://github.com/smithy-lang/smithy-typescript/pull/1272))
- Improved support for fetch and web-streams in Node.js ([#1256](https://github.com/smithy-lang/smithy-typescript/pull/1256))
- `@smithy/node-http-handler`, `"@smithy/util-stream`: Handle web streams in streamCollector and sdkStreamMixin
- Added service client doc generator only when typedoc is selected ([#1253](https://github.com/smithy-lang/smithy-typescript/pull/1253))

### Bug Fixes

- `@smithy/types`: Fixed type transforms account for no-args operation methods ([#1262](https://github.com/smithy-lang/smithy-typescript/pull/1262))
- Check dependencies when adding imports ([#1239](https://github.com/smithy-lang/smithy-typescript/pull/1239))
- Fixed typo in `HttpResponse` docs ([#958](https://github.com/smithy-lang/smithy-typescript/pull/958))
- Fixed URI escape path ([#1224](https://github.com/smithy-lang/smithy-typescript/pull/1224)) ([#1226](https://github.com/smithy-lang/smithy-typescript/pull/1226))

## 0.20.1 (2024-04-05)

### Features

- Updated SigV4 with its own header formatter to avoid import of entire eventstream-codec package ([#1233](https://github.com/smithy-lang/smithy-typescript/pull/1233))
- Updated Smithy Version to 1.47.0 ([#1225](https://github.com/smithy-lang/smithy-typescript/pull/1225))

### Bug Fixes

- Fix middleware-endpoint to check for s3 arn parts ([#1227](https://github.com/smithy-lang/smithy-typescript/pull/1227))

## 0.20.0 (2024-03-21)

### Features

- codegen: Identity and Auth, support for the `@auth` Smithy trait. See https://smithy.io/2.0/spec/authentication-traits.html#auth-trait.
- codegen: Support request compression ([#1129](https://github.com/smithy-lang/smithy-typescript/pull/1129))
- codegen: Allow commands to be constructed without arg if all arg fields optional ([#1206](https://github.com/smithy-lang/smithy-typescript/pull/1206))
- codegen: Generate unified error dispatcher ([#1150](https://github.com/smithy-lang/smithy-typescript/pull/1150))
- codegen: Generate Commands using Command classBuilder ([#1118](https://github.com/smithy-lang/smithy-typescript/pull/1118))
- codegen: Paginator factory ([#1115](https://github.com/smithy-lang/smithy-typescript/pull/1115))
- codegen: Generate paginators using a factory ([#1114](https://github.com/smithy-lang/smithy-typescript/pull/1114))
- codegen: XML serde reduction ([#1108](https://github.com/smithy-lang/smithy-typescript/pull/1108))
- codegen: Add requestBuilder, generate requests using a builder pattern ([#1107](https://github.com/smithy-lang/smithy-typescript/pull/1107))
- codegen-docs: Add deprecation message in shape docs ([#1209](https://github.com/smithy-lang/smithy-typescript/pull/1209))
- codegen-docs: Move documentation before release tag and deprecation ([#1211](https://github.com/smithy-lang/smithy-typescript/pull/1211))
- codegen-docs: Move deprecation after description in docs ([#1212](https://github.com/smithy-lang/smithy-typescript/pull/1212))
- codegen-docs: Add more information about BLOB values in structures ([#1182](https://github.com/smithy-lang/smithy-typescript/pull/1182))
- `@smithy/types`: Assertive client type helper ([#1076](https://github.com/smithy-lang/smithy-typescript/pull/1076))
- `@smithy/*`: `dist-cjs` artifacts are now generated as a bundle ([#1146](https://github.com/smithy-lang/smithy-typescript/pull/1146))
- `@smithy/util-base64`: Encoders now accept strings ([#1176](https://github.com/smithy-lang/smithy-typescript/pull/1176))
- `@smithy/node-http-handler`: Enable ctor arg passthrough for requestHandler ([#1167](https://github.com/smithy-lang/smithy-typescript/pull/1167))
- `@smithy/node-http-handler`: Add checked socket exhaustion warning when throughput is slow ([#1164](https://github.com/smithy-lang/smithy-typescript/pull/1164))
- `@smithy/node-http-handler`: Allow http(s).Agent ctor arg in lieu of instance ([#1165](https://github.com/smithy-lang/smithy-typescript/pull/1165))
- `@smithy/node-http-handler`: Reduce buffer copies ([#867](https://github.com/smithy-lang/smithy-typescript/pull/867))

### Bug Fixes

- codegen: Empty the contents of the dependencyVersions.properties file when creating it ([#1213](https://github.com/smithy-lang/smithy-typescript/pull/1213))
- codegen: Import _json function at call sites ([#1174](https://github.com/smithy-lang/smithy-typescript/pull/1174))
- codegen: Model bucketing edge case with resource shape ([#1123](https://github.com/smithy-lang/smithy-typescript/pull/1123))
- codegen: Use `TopDownIndex::getContainedOperations()` for operation iterations ([#1109](https://github.com/smithy-lang/smithy-typescript/pull/1109))
- codegen: Accommodate services with the world Client in their names ([#1102](https://github.com/smithy-lang/smithy-typescript/pull/1102))
- `@smithy/middleware-retry`: Retry after clock skew correction ([#1170](https://github.com/smithy-lang/smithy-typescript/pull/1170))
- `@smithy/middleware-retry`: Warn streaming requests are not retryable ([#1092](https://github.com/smithy-lang/smithy-typescript/pull/1092))
- `@smithy/core`: Handle multi-part token paths in paginator ([#1160](https://github.com/smithy-lang/smithy-typescript/pull/1160))
- `@smithy/util-utf8`: Use Node.js implementations in react-native ([#1070](https://github.com/smithy-lang/smithy-typescript/pull/1070))
- `@smithy/smithy-client`: Apply filtering when walking json arrays ([#1086](https://github.com/smithy-lang/smithy-typescript/pull/1086))
- `@smithy/util-body-length-browser`: Increase performance of body length calculation for larger payloads on browser ([#1088](https://github.com/smithy-lang/smithy-typescript/pull/1088))
- `@smithy/middleware-serde`: Allow error deserializers to populate error response body ([#1180](https://github.com/smithy-lang/smithy-typescript/pull/1180))
- `@smithy/shared-ini-file-loader`: Process sso-session names with config prefix separator ([#1173](https://github.com/smithy-lang/smithy-typescript/pull/1173))
- `@smithy/shared-ini-file-loader`: Process config files for profile names containing prefix separator ([#1100](https://github.com/smithy-lang/smithy-typescript/pull/1100))
- `@smithy/shared-ini-file-loader`: Allow dot, solidus, percent and colon characters in profile names ([#1067](https://github.com/smithy-lang/smithy-typescript/pull/1067))

### Documentation
- Add readme content for signature-v4 ([#1087](https://github.com/smithy-lang/smithy-typescript/pull/1087))
- Sigv4 README.md brackets ([#1103](https://github.com/smithy-lang/smithy-typescript/pull/1103))
- Fix README `smithy-build.json` examples ([#1082](https://github.com/smithy-lang/smithy-typescript/pull/1082))

## 0.19.0 (2023-11-02)

### Features
* Updated codegen plugins to match idiomatic plugin names([#1057](https://github.com/awslabs/smithy-typescript/pull/1057))
* Added flag for blocking imds v1 fallback behavior ([#1059](https://github.com/awslabs/smithy-typescript/pull/1059))
* Upgraded@babel/traverse from 7.21.2 to 7.23.2 ([#1041](https://github.com/awslabs/smithy-typescript/pull/1041))
* Upgraded browserify-sign from 4.2.1 to 4.2.2 ([#1058](https://github.com/awslabs/smithy-typescript/pull/1058))
* Updated to use migrated `util-endpoints` ([#1044](https://github.com/awslabs/smithy-typescript/pull/1044))
* Re-exported existing endpoint types ([#1055](https://github.com/awslabs/smithy-typescript/pull/1055))
* Added util-endpoints package ([#1043](https://github.com/awslabs/smithy-typescript/pull/1043))
* Allow TypeScriptIntegration to write prior to the config object literal ([#1054](https://github.com/awslabs/smithy-typescript/pull/1054))
* Updated to transform inputs for platform specific type helpers ([#1046](https://github.com/awslabs/smithy-typescript/pull/1046))
* Made `unionShape` deserializer overridable ([#1040](https://github.com/awslabs/smithy-typescript/pull/1040), [#1045](https://github.com/awslabs/smithy-typescript/pull/1045))
* Update to generate enum Record keys when target is enum ([#1037](https://github.com/awslabs/smithy-typescript/pull/1037))
* Removed "| string" and "| number" from enum targeted members ([#1028](https://github.com/awslabs/smithy-typescript/pull/1003))
* Added `-p` for `mkdir` in `build-generated-test-packages` ([#1010](https://github.com/awslabs/smithy-typescript/pull/1003))
* Added logging for `buildAndCopyToNodeModules()` ([#1003](https://github.com/awslabs/smithy-typescript/pull/1003))
* Reorganized models in `smithy-typescript-codegen-test` ([#995](https://github.com/awslabs/smithy-typescript/pull/995))
* Updated to export empty model index if no `model_*` files exist ([#996](https://github.com/awslabs/smithy-typescript/pull/996))
* Read service specific endpoints for environment or config ([#1014](https://github.com/awslabs/smithy-typescript/pull/1014))
* Updated to populate `sso-session` and services sections when loading config files ([#993](https://github.com/awslabs/smithy-typescript/pull/993))
* Added export `CONFIG_PREFIX_SEPARATOR` from `loadSharedConfigFiles` ([#992](https://github.com/awslabs/smithy-typescript/pull/992))
* Updated to pass configuration file as second parameter to `configSelector` ([#990](https://github.com/awslabs/smithy-typescript/pull/990))
* Updated to populate subsection using dot separator in section key when parsing INI files ([#989](https://github.com/awslabs/smithy-typescript/pull/989))
* Added support for reading values from main section when parsing INI files ([#986](https://github.com/awslabs/smithy-typescript/pull/986))

### Bug Fixes
* Exported `RuntimeExtension` and Client `ExtensionConfiguration` interfaces ([#1057](https://github.com/awslabs/smithy-typescript/pull/1057))
* Removed `TARGET_NAMESPACE` from `TypeScriptSettings` ([#1057](https://github.com/awslabs/smithy-typescript/pull/1057))
* Updated Server Codegen to generate without a protocol ([#1057](https://github.com/awslabs/smithy-typescript/pull/1057))
* Updated to use partial record for enum keyed types ([#1049](https://github.com/awslabs/smithy-typescript/pull/1049))
* Allowed lowercase type names for endpoint parameters ([#1050](https://github.com/awslabs/smithy-typescript/pull/1050))
* Added parsing for profile name with invalid '+' character ([#1047](https://github.com/awslabs/smithy-typescript/pull/1047))
* Added missing map shape reference ([#1038](https://github.com/awslabs/smithy-typescript/pull/1038))
* Adds parsing for profile name with invalid '@' character ([#1036](https://github.com/awslabs/smithy-typescript/pull/1036))
* Treat absence of prefix whitespace as section keys when reading ini files ([#1029](https://github.com/awslabs/smithy-typescript/pull/1029))
* Added missing dependency of `@smithy/shared-ini-file-loader` ([#1027](https://github.com/awslabs/smithy-typescript/pull/1027))
* Fixed operation index file codegen ([#1025](https://github.com/awslabs/smithy-typescript/pull/1025))
* Removed extra `$` from `HttpApiKeyAuthSigner` ([#1006](https://github.com/awslabs/smithy-typescript/pull/1006))
* Added await to `signer.sign()` in `httpSigningMiddleware` ([#1005](https://github.com/awslabs/smithy-typescript/pull/1005))
* Fixed `@httpApiKeyAuth` scheme property ([#1001](https://github.com/awslabs/smithy-typescript/pull/1001))
* Fixed `HttpAuthSchemeParameters` codegen ([#998](https://github.com/awslabs/smithy-typescript/pull/998))
* Fixed `resolveHttpAuthSchemeConfig` imports ([#997](https://github.com/awslabs/smithy-typescript/pull/997))
* Updated default `keepalive=false` for fetch ([#1016](https://github.com/awslabs/smithy-typescript/pull/1016))

## 0.18.0 (2023-10-04)

### Features
* Add SSDK codegen test ([#825](https://github.com/awslabs/smithy-typescript/pull/825))
* Add test script when specs are generated ([#821](https://github.com/awslabs/smithy-typescript/pull/821))
* Move vitest config to js ([#833](https://github.com/awslabs/smithy-typescript/pull/833))
* Add PackageContainer interface ([#837](https://github.com/awslabs/smithy-typescript/pull/837))
* Add codegen for improved streaming payload types ([#840](https://github.com/awslabs/smithy-typescript/pull/840))
* Set public release tags on client config interface components ([#850](https://github.com/awslabs/smithy-typescript/pull/850))
* Check for Optional Configuration in client constructor ([#859](https://github.com/awslabs/smithy-typescript/pull/859))
* Add matchSettings() to RuntimeClientPlugins ([#856](https://github.com/awslabs/smithy-typescript/pull/856))
* Add experimentalIdentityAndAuth flag ([#857](https://github.com/awslabs/smithy-typescript/pull/857))
* Add extensions to client runtime config ([#852](https://github.com/awslabs/smithy-typescript/pull/852))
* Use ASCII replacement for character 0xE2 ([#866](https://github.com/awslabs/smithy-typescript/pull/866))
* Add more auth traits to generic client tests ([#882](https://github.com/awslabs/smithy-typescript/pull/882))
* Rename defaultClientConfiguration to defaultExtensionConfiguration ([#888](https://github.com/awslabs/smithy-typescript/pull/888))
* Update codegen to use defaultExtensionConfiguration ([#889](https://github.com/awslabs/smithy-typescript/pull/889))
* Add matchSettings() to TypeScriptIntegration and TypeScriptCodegenPlugin ([#901](https://github.com/awslabs/smithy-typescript/pull/901))
* Add codegen and TS integration points for config ([#881](https://github.com/awslabs/smithy-typescript/pull/881))
* Add generic @httpApiKeyAuth support ([#883](https://github.com/awslabs/smithy-typescript/pull/883))
* Add generic @httpBearerAuth support ([#884](https://github.com/awslabs/smithy-typescript/pull/884))
* Add generic @aws.auth#sigv4 support ([#885](https://github.com/awslabs/smithy-typescript/pull/885))
* Update HttpAuthOption and HttpAuthScheme codegen ([#907](https://github.com/awslabs/smithy-typescript/pull/907))
* Update ExtensionConfigurations to generate for clients only ([#911](https://github.com/awslabs/smithy-typescript/pull/911))
* Add codegen for http component in runtime extension ([#913](https://github.com/awslabs/smithy-typescript/pull/913))
* Add codegen for HttpAuthExtensionConfiguration ([#910](https://github.com/awslabs/smithy-typescript/pull/910))
* Add HttpAuthScheme interfaces for auth scheme resolution ([#928](https://github.com/awslabs/smithy-typescript/pull/928))
* Add service and operation names to HandlerExecutionContext ([#934](https://github.com/awslabs/smithy-typescript/pull/934))
* Add httpSigningMiddleware to authorize and sign requests ([#930](https://github.com/awslabs/smithy-typescript/pull/930))
* Make writeDocs() with Runnable public ([#939](https://github.com/awslabs/smithy-typescript/pull/939))
* Refactor HttpAuthScheme properties to builders ([#941](https://github.com/awslabs/smithy-typescript/pull/941))
* Reorganize http auth module constants ([#942](https://github.com/awslabs/smithy-typescript/pull/942))
* Rename to generateDefaultHttpAuthSchemeProviderFunction() ([#946](https://github.com/awslabs/smithy-typescript/pull/946))
* Add traitId to HttpAuthScheme ([#947](https://github.com/awslabs/smithy-typescript/pull/947))
* Add customizing default httpAuthSchemeProvider and httpAuthSchemeParametersProvider ([#943](https://github.com/awslabs/smithy-typescript/pull/943))
* Add partial support for aws.auth#sigv4a ([#950](https://github.com/awslabs/smithy-typescript/pull/950))
* Update @smithy.rules#endpointRuleSet codegen ([#945](https://github.com/awslabs/smithy-typescript/pull/945))
* Add collect*() methods to dedupe ConfigFields and HttpAuthSchemeParameter ([#948](https://github.com/awslabs/smithy-typescript/pull/948))
* Add httpAuthSchemeMiddleware to select an auth scheme ([#929](https://github.com/awslabs/smithy-typescript/pull/929))
* Add SmithyContextCodeSection to CommandGenerator ([#957](https://github.com/awslabs/smithy-typescript/pull/957))
* Add link for retryModes input enum ([#962](https://github.com/awslabs/smithy-typescript/pull/962))
* Add aliases for httpSigningMiddleware ([#970](https://github.com/awslabs/smithy-typescript/pull/970))
* Update endpoint rules engine tests ([#976](https://github.com/awslabs/smithy-typescript/pull/976))
* Upgrade to Smithy 1.39.0 ([#976](https://github.com/awslabs/smithy-typescript/pull/976))

### Bug fixes
* Fix types import ([#831](https://github.com/awslabs/smithy-typescript/pull/831))
* Allow lowercase endpoint param ([#923](https://github.com/awslabs/smithy-typescript/pull/923))
* Generate jsdocs for operations with no documentation ([#971](https://github.com/awslabs/smithy-typescript/pull/971))
* Fix missing release tag on shape members ([#854](https://github.com/awslabs/smithy-typescript/pull/854))

## 0.17.1 (2023-07-07)

### Bug fixes

* Fixed @smithy/protocol-http import in HttpApiKeyAuth spec ([#817](https://github.com/awslabs/smithy-typescript/pull/817))

## 0.17.0 (2023-07-06)

### Features

* Upgraded to Smithy 1.33.0 ([#808](https://github.com/awslabs/smithy-typescript/pull/808))
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
