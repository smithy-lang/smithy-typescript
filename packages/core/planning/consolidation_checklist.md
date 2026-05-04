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
- [ ] When merging platform-specific packages (e.g. `util-defaults-mode-browser` + `util-defaults-mode-node`), use `.browser.ts` and `.native.ts` variants in a single directory.

## Old package cleanup

- [ ] Delete README.md, CHANGELOG.md, all source files, and all test files in the old `packages/<package>` folder.
- [ ] Delete all dependencies and browser/react-native replacement metadata in package.json.
- [ ] Remove `typesVersions` metadata from package.json.
- [ ] Preserve only the build, clean, and stage-release NPM scripts.
- [ ] Take a dependency on `@smithy/core`.
- [ ] Re-export from `@smithy/core` every symbol that was previously exported for backwards compatibility.
- [ ] Delete leftover sub-directory barrel files (e.g. `src/endpointsConfig/index.ts`) — only `src/index.ts` should remain.

## Dependency updates (TypeScript)

- [ ] Remove the old package from `dependencies` in all `packages/*/package.json` and `private/*/package.json`.
- [ ] Add `@smithy/core` as a dependency where not already present.
- [ ] Do not add `@smithy/core` as a dependency to packages that core itself depends on (creates a cycle).
- [ ] If a package in core's dependency chain has a type-only import from a consolidated package, inline the type to break the cycle.
- [ ] Remove the old package from `core/package.json` dependencies.
- [ ] Add any new transitive dependencies to `core/package.json` (e.g. `@smithy/util-buffer-from`).
- [ ] Update all source imports (`from "@smithy/old-package"` → `from "@smithy/core/<submodule>"`).
- [ ] Update `vi.mock()` paths in test files to match the new import paths. This includes mocks of the old package name (e.g. `vi.mock("@smithy/old-package")` → `vi.mock("@smithy/core/<submodule>")`) and mocks of relative paths that changed due to file relocation.
- [ ] Don't forget `smithy-typescript-ssdk-libs/` packages.
- [ ] Add the old package names to the banned imports list in `.eslintrc.js`, one group per submodule.

## Browser/React-Native field updates

- [ ] Mark all Node-only files as `false` in the `browser` field of `core/package.json`.
- [ ] Mark all Node-only files as `false` in the `react-native` field (both `dist-es` and `dist-cjs` entries).
- [ ] For `.browser.ts` variants, add replacement entries in the `browser` field.
- [ ] For `.native.ts` variants, add replacement entries in the `react-native` field (both `dist-es` and `dist-cjs`).
- [ ] Ensure exports from `browser: false` files are not re-exported from other non-false files. Move such exports to a browser-safe file (e.g. `constants.ts`).
- [ ] Browser spec tests (`*.browser.spec.ts`) must import explicitly from the `.browser.ts` variant file, not the default — vitest does not resolve the `browser` field.

## Dependency updates (Java codegen)

- [ ] Move (don't delete) `TypeScriptDependency` enum values in the deprecated group at the end of the enum.
- [ ] Update all `addImport` call sites to `addImportSubmodule` with `SMITHY_CORE` + `SmithyCoreSubmodules.<SUBMODULE>`.
- [ ] Update all `addTypeImport` call sites to `addTypeImportSubmodule`.
- [ ] Update all `addDependency(OLD)` to `addDependency(SMITHY_CORE)`.
- [ ] Update `withConventions` calls to use `"@smithy/core/<submodule>"` as the package name string.
- [ ] For `ExtensionConfigurationInterface` implementations, override `submodule()` to return the submodule path.
- [ ] Add new submodule constants to `SmithyCoreSubmodules.java`.
- [ ] Update downstream codegen (e.g. `smithy-aws-typescript-codegen`) call sites.
- [ ] Ensure serde symbols (e.g. `expectNonNull`, `parseEpochTimestamp`) route to `SERDE`, not `CLIENT`, even if they were previously imported from `smithy-client`.

## Verification

- [ ] `make build` — Java codegen compiles and all tests pass.
- [ ] `make generate-protocol-tests test-protocols` — regenerated private packages have correct deps and imports.
- [ ] `yarn` — workspace resolution succeeds with no cyclic dependency errors from Turbo.
- [ ] `yarn build` — all packages compile and build. Run this in the repo root, not just the changed packages.
- [ ] `yarn test` — all unit tests pass.
- [ ] `yarn test:integration` — includes bundler and browser tests.
- [ ] `make bgt` — write the actual snapshot files.
- [ ] `yarn lint` in `packages/core` — no cross-submodule relative import violations.
- [ ] `api-snapshot` script snapshots submodule exports via `package.json` `exports` entries.
