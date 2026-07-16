# ts-compat

Verifies that the generated clients compile on every TypeScript version listed
in [`typescript-versions.json`](./typescript-versions.json).

The `@smithy/*` packages support TypeScript 3.4+ (types are downleveled for
older releases via `typesVersions` / `dist-types/ts3.4`). This test guards that
support by type-checking a small fixture that imports and uses one generated
client per codegen variant against each version.

smithy-typescript does not ship end-user SDK clients, so the fixture uses the
generated protocol-test clients under `private/`. They pull in the full
`@smithy/*` type surface (client, commands, models, endpoints, retry, auth) that
downstream SDKs re-export, which makes compiling them a good proxy for the
type-level compatibility of the packages themselves.

## What it does

For every version in `typescript-versions.json`, the runner:

1. Installs that TypeScript version in isolation (under `.tmp/`).
2. Type-checks [`fixtures/index.ts`](./fixtures/index.ts) against it.

The clients' published `.d.ts` are parsed (so downlevel _syntax_
incompatibilities surface), while `skipLibCheck` avoids failing on their
internal Node references (see [`tsconfig.json`](./tsconfig.json)). Work is
parallelized across a pool of worker threads sized to the number of available
processors.

The clients and their transitive `@smithy/*` dependencies are resolved from the
workspace root `node_modules` (they are symlinked there by yarn), so this suite
does not install its own copy of them - only the TypeScript compiler is
installed per version.

## Running

This suite runs as part of the `test-typescript-versions` Make target:

```bash
make test-typescript-versions
```

You can also run it directly:

```bash
cd testbed/ts-compat && node ./run.mjs
```

`run.mjs` first runs `npx turbo run build:types:downlevel` itself: TypeScript
`<= 4.5` resolves to the `dist-types/ts3.4` declarations via each package's
`typesVersions`, and the default build does not produce them. turbo caches the
task, so this is cheap on repeat runs.

Either way assumes the generated clients are already built (their `dist-types`
are present). `run.mjs` errors with guidance if the clients are missing - run
`make generate-protocol-tests` (and `make build-packages`) first.

## Codegen coverage

| Protocol / service | Codegen | Client                                       |
| ------------------ | ------- | -------------------------------------------- |
| rpcv2Cbor          | classic | `@smithy/smithy-rpcv2-cbor`                  |
| rpcv2Cbor          | schema  | `@smithy/smithy-rpcv2-cbor-schema`           |
| XYZService         | classic | `xyz` (private/my-local-model)               |
| XYZService         | schema  | `xyz-schema` (private/my-local-model-schema) |

Add more clients to the fixture as new protocols or codegen paths are covered by
the protocol-test projections in
`smithy-typescript-protocol-test-codegen/smithy-build.json`.

## Updating the supported versions

Edit `typescript-versions.json`. Each entry is `{ version, tscArgs? }`:

- `version` — any spec npm accepts (a bare minor like `"5.4"` installs its latest patch).
- `tscArgs` — optional compiler flags for that version, passed on the command line
  to override `tsconfig.json` when an option changed. For example, `moduleResolution:
node` (node10) became a deprecation error in TS 6.0 and was removed in TS 7.0.
