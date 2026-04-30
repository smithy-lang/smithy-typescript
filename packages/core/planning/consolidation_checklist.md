# Consolidation checklist

For each group of packages being consolidated into a `@smithy/core` submodule:

## Source migration

- [ ] Copy source files (excluding barrel `index.ts`) into `core/src/submodules/<submodule>/<package>/`
- [ ] Use explicit named exports in the submodule's canonical `index.ts` — no `export *`
- [ ] Do not create intermediate barrel `index.ts` files in sub-folders; export directly from source files
- [ ] Fix internal imports within copied files (e.g. `@smithy/protocol-http` → relative path within the submodule)
- [ ] Cross-submodule imports must use `@smithy/core/<submodule>`, not relative paths (lint enforces this)

## Old package cleanup

- [ ] Delete the old `packages/<package>` folder
- [ ] Save `README.md` and `CHANGELOG.md` as contextual artifacts alongside the new source
- [ ] Add consolidation notice to the top of each changelog
- [ ] Remove the package from `api-snapshot/api.json` but ensure that the API snapshot contains the additions to the
      appropriate core submodule.

## Dependency updates (TypeScript)

- [ ] Remove the old package from `dependencies` in all `packages/*/package.json` and `private/*/package.json`
- [ ] Add `@smithy/core` as a dependency where not already present
- [ ] Remove the old package from `core/package.json` dependencies
- [ ] Add any new transitive dependencies to `core/package.json` (e.g. `@smithy/util-buffer-from`)
- [ ] Update all source imports (`from "@smithy/old-package"` → `from "@smithy/core/<submodule>"`)
- [ ] Don't forget `smithy-typescript-ssdk-libs/` packages

## Dependency updates (Java codegen)

- [ ] Mark the old `TypeScriptDependency` enum values as `@Deprecated` with a comment pointing to the replacement
- [ ] Change deprecated enum values from `unconditional: true` to `false`
- [ ] Update all `addImport` call sites to `addImportSubmodule` with `SMITHY_CORE` + `SmithyCoreSubmodules.<SUBMODULE>`
- [ ] Update all `addTypeImport` call sites to `addTypeImportSubmodule`
- [ ] Update all `addDependency(OLD)` to `addDependency(SMITHY_CORE)`
- [ ] Update `withConventions` calls to use `"@smithy/core/<submodule>"` as the package name string
- [ ] `RuntimeClientPlugin.Convention.createSymbol` extracts the base package name for `addDependency` — verify
      submodule paths don't leak into generated `package.json`
- [ ] For `ExtensionConfigurationInterface` implementations, override `submodule()` to return the submodule path
- [ ] Add new submodule constants to `SmithyCoreSubmodules.java`
- [ ] Handle `null` version gracefully in `TypeScriptDependency` constructor for deleted packages

## Verification

- [ ] `make build` — Java codegen compiles and all tests pass
- [ ] `make generate-protocol-tests test-protocols` — regenerated private packages have correct deps and imports
- [ ] `yarn` — workspace resolution succeeds
- [ ] `yarn lint` in `packages/core` — no cross-submodule relative import violations
- [ ] `yarn build` — all packages compile and build. Run this in the repo root, not just the changed packages.
- [ ] `api-snapshot` script snapshots submodule exports via `package.json` `exports` entries
