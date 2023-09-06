# server-common Changelog

## 1.0.0-alpha.10 (2023-04-18)

### Bug Fixes

- Fix `uniqueItems` validation not to throw when undefined values are nested inside a list of objects.

## 1.0.0-alpha.9 (2023-03-16)

### Features

- Updated validation messages to remove user input values and internal enum values. ([#695](https://github.com/awslabs/smithy-typescript/pull/695), [#704](https://github.com/awslabs/smithy-typescript/pull/704), [#713](https://github.com/awslabs/smithy-typescript/pull/713))

### Other

- Upgraded to Yarn 3. ([#705](https://github.com/awslabs/smithy-typescript/pull/705))

## 1.0.0-alpha.8 (2023-02-09)

### Features

- Generated ES module distributions. ([#685](https://github.com/awslabs/smithy-typescript/pull/685))
- Used re2 `test()` instead of `match()`. ([#680](https://github.com/awslabs/smithy-typescript/pull/680))

## 1.0.0-alpha.7 (2023-01-25)

### Features

- Added intEnum validator. ([#654](https://github.com/awslabs/smithy-typescript/pull/654))

## 1.0.0-alpha.6 (2022-08-22)

### Features

- Used Record type in place of Object in SSDK libs. ([#558](https://github.com/awslabs/smithy-typescript/pull/558))
- Updated shelljs, minimist dependencies. ([#497](https://github.com/awslabs/smithy-typescript/pull/497), [#529](https://github.com/awslabs/smithy-typescript/pull/529))
- Updated SDK dependencies.

## 1.0.0-alpha.5 (2022-02-23)

### Features

- Defined ServiceException as base class for service side exception. ([#502](https://github.com/awslabs/smithy-typescript/pull/502))
- Updated SDK dependencies.

### Bug Fixes

- Fix the uniqueItems implementation to accommodate non-primitive values. ([#511](https://github.com/awslabs/smithy-typescript/pull/511))
- Fixed the implementation of length validation for strings. ([#510](https://github.com/awslabs/smithy-typescript/pull/510))

### Other

- Converted from lerna to turborepo. ([#506](https://github.com/awslabs/smithy-typescript/pull/506))

## 1.0.0-alpha.4 (2022-01-03)

### Features

- Switched to re2-wasm for pattern validation. ([467](https://github.com/awslabs/smithy-typescript/pull/467))
- Updated SDK dependencies.

### Bug Fixes

- Fixed greedy label matching. ([474](https://github.com/awslabs/smithy-typescript/pull/474))

## 1.0.0-alpha.3 (2021-11-03)

### Features

- Switch to re2 for pattern validation ([451](https://github.com/awslabs/smithy-typescript/pull/451))
- Add a helper function for parsing Accept headers ([431](https://github.com/awslabs/smithy-typescript/pull/431))
- Update SDK dependencies ([439](https://github.com/awslabs/smithy-typescript/pull/439))

### Bug Fixes

- Fix query matching against list query values ([450](https://github.com/awslabs/smithy-typescript/pull/450))
