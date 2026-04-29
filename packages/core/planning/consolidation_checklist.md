# Consolidation checklist

For each group of packages being consolidated into a `@smithy/core` submodule:

## Source migration

- [ ] Copy source files (excluding barrel `index.ts`) into `core/src/submodules/<submodule>/<package>/`.
- [ ] Use explicit named exports in the submodule's canonical `index.ts` — no `export *`.
- [ ] Do not create intermediate barrel `index.ts` files in sub-folders; export directly from source files.
- [ ] Fix internal imports within copied files (e.g. `@smithy/protocol-http` → relative path within the submodule).
- [ ] Cross-submodule imports must use `@smithy/core/<submodule>`, not relative paths (lint enforces this).
- [ ] If a dependency would create a cycle, inline the needed functions locally.
- [ ] Save `CHANGELOG.md` as contextual artifacts alongside the new source folder.
- [ ] Add consolidation notice to the top of each new changelog file.
- [ ] For Node-only modules (e.g. `hash-node`), mark them as `false` in `browser` and `react-native` fields.

## Old package cleanup

- [ ] Delete README.md, CHANGELOG.md, all source files, and all test files in the old `packages/<package>` folder.
- [ ] Delete all dependencies and browser/react-native replacement metadata in package.json.
- [ ] Remove `typesVersions` metadata from package.json.
- [ ] Preserve only the build, clean, and stage-release NPM scripts.
- [ ] Take a dependency on `@smithy/core`.
- [ ] Re-export from `@smithy/core` every symbol that was previously exported for backwards compatibility.

## Dependency updates (TypeScript)

- [ ] Remove the old package from `dependencies` in all `packages/*/package.json` and `private/*/package.json`.
- [ ] Add `@smithy/core` as a dependency where not already present.
- [ ] Do not add `@smithy/core` as a dependency to packages that core itself depends on (creates a cycle).
- [ ] Remove the old package from `core/package.json` dependencies.
- [ ] Add any new transitive dependencies to `core/package.json` (e.g. `@smithy/util-buffer-from`).
- [ ] Update all source imports (`from "@smithy/old-package"` → `from "@smithy/core/<submodule>"`).
- [ ] Update `vi.mock()` paths in test files to match the new import paths.
- [ ] Don't forget `smithy-typescript-ssdk-libs/` packages.
- [ ] Add the old package names to the banned imports list in `.eslintrc.js`, one group per submodule.

## Dependency updates (Java codegen)

- [ ] Delete the old `TypeScriptDependency` enum values.
- [ ] Update all `addImport` call sites to `addImportSubmodule` with `SMITHY_CORE` + `SmithyCoreSubmodules.<SUBMODULE>`.
- [ ] Update all `addTypeImport` call sites to `addTypeImportSubmodule`.
- [ ] Update all `addDependency(OLD)` to `addDependency(SMITHY_CORE)`.
- [ ] Update `withConventions` calls to use `"@smithy/core/<submodule>"` as the package name string.
- [ ] For `ExtensionConfigurationInterface` implementations, override `submodule()` to return the submodule path.
- [ ] Add new submodule constants to `SmithyCoreSubmodules.java`.
- [ ] Update downstream codegen (e.g. `smithy-aws-typescript-codegen`) call sites.

## Verification

- [ ] `make build` — Java codegen compiles and all tests pass.
- [ ] `make generate-protocol-tests test-protocols` — regenerated private packages have correct deps and imports.
- [ ] `yarn` — workspace resolution succeeds.
- [ ] `yarn build` — all packages compile and build. Run this in the repo root, not just the changed packages.
- [ ] `yarn test` — all unit tests pass.
- [ ] `yarn test:integration` — includes bundler and browser tests.
- [ ] `yarn lint` in `packages/core` — no cross-submodule relative import violations.
- [ ] `api-snapshot` script snapshots submodule exports via `package.json` `exports` entries.
