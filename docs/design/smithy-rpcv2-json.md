# Design: Smithy RPC v2 JSON support in smithy-typescript

Status: In progress
Author: kingaly
Last updated: 2026-09-15

## 1. Summary

This document describes the changes made to add **Smithy RPC v2 JSON**
(`smithy.protocols#rpcv2Json`) support to `smithy-typescript`, alongside the
existing **Smithy RPC v2 CBOR** (`smithy.protocols#rpcv2Cbor`) implementation.

RPC v2 JSON is the second protocol in the Smithy RPC v2 family. It uses the same
RPC-over-HTTP envelope as RPC v2 CBOR — `POST` to
`/service/{serviceName}/operation/{operationName}`, a `smithy-protocol` marker
header, and whole-body request/response payloads — but serializes the body as
JSON text instead of CBOR bytes.

The work spans three layers:

1. **Runtime** (`@smithy/core`): the client protocol class and JSON codec that
   generated clients use at request/response time.
2. **Codegen** (`smithy-typescript-codegen`): the Java protocol generator that
   emits clients and protocol tests for services modeled with the `rpcv2Json`
   trait.
3. **Build/test harness** (`smithy-typescript-protocol-test-codegen`, `Makefile`):
   wiring the generated JSON protocol-test package into the build and test flow.

## 2. Background

### 2.1 The RPC v2 family

The Smithy RPC v2 protocols were designed for unambiguous request/response
identification, idiomatic HTTP usage, graceful degradation, and support for
multiple serialization formats. CBOR shipped first (binary). JSON is the second
format and addresses gaps such as API Gateway JSON-integration compatibility and
(in the spec) lossless arbitrary-precision numbers transmitted as strings.

Reference: the RPC v2 JSON SEP (Smithy Enhancement Proposal). Key normative
points relevant to this work:

- Requests: `POST`, `smithy-protocol: rpc-v2-json`, `Content-Type` and `Accept`
  of `application/json`, path `{prefix?}/service/{serviceName}/operation/{operationName}`,
  no `X-Amz(n)-Target` headers, unit-input operations send no body.
- Timestamps: always epoch-seconds; the `timestampFormat` trait **must not** be
  respected.
- `blob`: base64 string. `bigInteger`/`bigDecimal`: JSON strings (precision).
- Errors: discriminated by a body `__type` field (absolute shape ID).
- `awsQueryCompatible` is an AWS concern layered on top, not part of the core
  Smithy protocol.

### 2.2 Layering in smithy-typescript

- `smithy-typescript-codegen` (Java) turns a Smithy model into a TypeScript
  package (client, commands, schemas, and protocol tests).
- `@smithy/core` provides the runtime the generated code depends on, including
  the protocol classes (`SmithyRpcV2CborProtocol`, now `SmithyRpcV2JsonProtocol`)
  and the JSON codec (`JsonCodec2` and its `JsonShapeSerializer2` /
  `JsonShapeDeserializer2`).
- `smithy-typescript-protocol-test-codegen` runs codegen against the Smithy
  protocol-test models and emits runnable Vitest packages under `private/`.

## 3. Goals / Non-goals

### Goals

- A runtime client protocol for RPC v2 JSON that mirrors the CBOR protocol,
  differing only in wire format.
- A codegen protocol generator so services modeled with `rpcv2Json` generate
  clients and protocol tests, parallel to the CBOR generator.
- Wire the generated JSON protocol-test package into the build.

### Non-goals (deferred)

- Arbitrary-precision `bigInteger` / `bigDecimal` end-to-end conformance. The SEP
  itself defers this for public AWS SDKs; see §7.
- Server-side RPC v2 JSON (`SmithyRpcV2JsonServerProtocol`).
- `awsQueryCompatible` support for JSON (AWS-layer concern).
- Snapshot-test baselines for the JSON package.

## 4. Runtime changes (`@smithy/core`)

### 4.1 `SmithyRpcV2JsonProtocol`

`packages/core/src/submodules/protocols/json/SmithyRpcV2JsonProtocol.ts`

A client protocol extending `RpcProtocol` → `HttpProtocol`, structurally
identical to `SmithyRpcV2CborProtocol`. The base classes supply the generic
RPC-over-HTTP flow (schema-driven serialize/deserialize, POST, error dispatch,
endpoint/host-prefix, event streams). This class supplies the JSON specifics:

- Codec: `JsonCodec2` instead of `CborCodec`.
- `getShapeId()` → `smithy.protocols#rpcv2Json`.
- `getDefaultContentType()` → `application/json`.
- `serializeRequest`: after `super`, sets `content-type`/`accept` to
  `application/json` and `smithy-protocol: rpc-v2-json`; drops body + content-type
  for unit input; substitutes the string `"{}"` for an empty non-unit body;
  appends the `/service/{service}/operation/{operation}` path.
- `handleError`: uses `loadJsonRpcErrorCode` (from `parseJsonBody`) to read the
  `__type` discriminator, then resolves and throws the typed exception; error
  struct members are decoded via `JsonShapeDeserializer2.readObject`.

**Timestamp handling.** The codec is constructed with
`timestampFormat: { useTrait: false, default: 7 /* epoch-seconds */ }`. Setting
`useTrait: false` forces epoch-seconds for all timestamps and ignores the
model's `timestampFormat` trait, as the SEP requires. (An earlier iteration used
`useTrait: true`, which incorrectly honored the trait and failed the
`TimestampFormatIgnored` protocol test.)

### 4.2 `JsonShapeSerializer2`: big-number quoting

`packages/core/src/submodules/protocols/json/codec-v2/JsonShapeSerializer2.ts`

Per the SEP, `bigInteger` and `bigDecimal` serialize as JSON **strings**. A
schema-driven branch was added to `writeValue`, before the type-based branches,
so that when the normalized schema is `isBigIntegerSchema()` or
`isBigDecimalSchema()`, the value is written as a quoted string regardless of its
incoming JS representation (`number`, `bigint`, `NumericValue`, big.js, or
`string`):

```ts
if (value != null && (ns.isBigIntegerSchema() || ns.isBigDecimalSchema())) {
  const asString = value instanceof NumericValue ? value.string : String(value);
  this.writeAsciiQuoted(asString);
  return;
}
```

This fixed the `BigIntegerSimpleValue` / `BigDecimalSimpleValue` request tests.
The remaining high-precision cases fail for a reason outside serde; see §7.

### 4.3 New submodule exports

`packages/core/src/submodules/protocols/index.ts`

Exported the JSON runtime helpers so generated code can import them from the
`@smithy/core/protocols` submodule:

- `SmithyRpcV2JsonProtocol`
- `parseJsonBody`, `parseJsonErrorBody`, `loadJsonRpcErrorCode`,
  `loadRestJsonErrorCode`

These previously existed in `parseJsonBody.ts` but were not part of the
submodule's public surface, so generated deserializer code could not reference
them.

> Note: several files under `protocols/` and `protocols/json/` (the codec-v1 /
> codec-v2 directories, `UnionSerde.ts`, `common.ts`, `writeKey.ts`,
> `JsonSettings.ts`, `jsonReplacer.ts`, etc.) were synced into `@smithy/core`
> as part of enabling the JSON codec. Self-referencing `@smithy/core/*` imports
> within the `protocols` submodule were converted to relative imports to satisfy
> the submodule linter (`scripts/validation/submodules-linter.js`).

## 5. Codegen changes (`smithy-typescript-codegen`)

### 5.1 `SmithyRpcV2Json` protocol generator

`.../codegen/protocols/json/SmithyRpcV2Json.java`

A classic (non-schema) protocol generator extending `HttpRpcProtocolGenerator`,
parallel to `SmithyRpcV2Cbor`:

- `getProtocol()` → `Rpcv2JsonTrait.ID`.
- `getDocumentContentType()` → `application/json`.
- `writeSharedRequestHeaders` → `smithy-protocol: rpc-v2-json`, `accept: application/json`.
- `getOperationPath` → `/service/{service}/operation/{operation}`.
- `serializeInputDocument` → `body = JSON.stringify(...)`.
- `writeErrorCodeParser` → `loadJsonRpcErrorCode`.
- `generateProtocolTests` → delegates to `SmithyProtocolUtils.generateProtocolTests(this, ctx)`.
- `generateSharedComponents` → imports `parseJsonBody as parseBody`,
  `parseJsonErrorBody as parseErrorBody`, and `loadJsonRpcErrorCode` (the names
  the shared RPC scaffolding emits), then calls `super`.
- Does **not** override `writeUndefinedInputBody`, so unit-input operations send
  no body — matching the SEP and CBOR.

### 5.2 JSON serde visitors

`.../codegen/protocols/json/`

- `JsonRpcMemberSerVisitor` / `JsonRpcMemberDeserVisitor`: thin subclasses of the
  base `DocumentMember*Visitor`. The base defaults are already JSON-correct
  (blob → base64, float/double → `serializeFloat`, big numbers → strings). Only
  timestamps are overridden to force epoch-seconds (SEP).
- `JsonRpcShapeSerVisitor` / `JsonRpcShapeDeserVisitor`: mirror the CBOR shape
  visitors (format-neutral object builders — `take(...)`, `Object.entries().reduce(...)`,
  union `.visit(...)`), delegating to the JSON member visitors.

### 5.3 Registration and gating

- `AddProtocols.getProtocolGenerators()`: added `new SmithyRpcV2Json()` alongside
  `new SmithyRpcV2Cbor()`. This is what causes `HttpProtocolTestGenerator` to run
  for the JSON service and emit `test/functional/rpcv2json.spec.ts`.
- `SchemaGenerationAllowlist`: added `Rpcv2JsonTrait.ID` to `PROTOCOLS` and
  `smithy.protocoltests.rpcv2Json#RpcV2JsonProtocol` to `ALLOWED`. Without this,
  the JSON service fell back to classic serde (a `protocols/Rpcv2json.ts` with a
  `big.js` import) instead of the schema-based path, and failed to type-check.
- `AddProtocolConfig`: added a JSON branch to the SHARED runtime-config writer so
  the generated client's `runtimeConfig` sets a default
  `protocol: SmithyRpcV2JsonProtocol` (imported from `@smithy/core/protocols`)
  and `protocolSettings.defaultNamespace`. Without this, the schema client had no
  default protocol and threw `config.protocol.setSerdeContext is not a function`
  at construction. The `protocolSettings` writer was extracted to a shared local
  used by both the CBOR and JSON branches.

## 6. Build/test harness changes

- `smithy-typescript-protocol-test-codegen/smithy-build.json`: already contained
  the `smithy-rpcv2-json-schema` projection targeting
  `smithy.protocoltests.rpcv2Json#RpcV2JsonProtocol` with schema + index +
  snapshot test generation.
- `Makefile` `test-protocols`: added a line to run the JSON package's tests. The
  current form matches the cbor-schema entry (unfiltered, includes
  `test:integration`). Because the deferred items in §7 are not yet resolved,
  this line does not currently pass; see Open Questions.

## 7. Known gaps / deferred work

1. **Arbitrary-precision numbers (`bigInteger` / `bigDecimal`).**
   The serializer now emits big numbers as quoted strings (§4.2), which fixes the
   simple-value cases. The remaining high-precision / exceeding-long-range cases
   fail because the **shared** protocol-test generator
   (`HttpProtocolTestGenerator.numberNode`) emits big values as bare JS number
   literals (e.g. `9223372036854775808,`), which lose precision at parse time
   before serde runs. Correct handling means emitting `BigInt(...)` /
   `NumericValue` for big-number shapes in generated tests — a change to shared
   codegen affecting all protocols, and the exact arbitrary-precision behavior
   the SEP defers for public AWS SDKs. On the response side, the deserializer
   returns a JS `BigInt`, which the generated test harness cannot `JSON.stringify`
   in its assertion-failure messages (`Do not know how to serialize a BigInt`).

2. **Snapshot baselines.** The JSON package has no `test/snapshots/*.txt`
   baselines (CBOR's are committed). `test:integration` therefore cannot pass
   until baselines are generated and reviewed.

3. **`make test-protocols` scope.** Two options were considered: (A) implement
   the shared arbitrary-precision test-generation fix and generate snapshot
   baselines so the unfiltered JSON line passes; (B) scope the JSON line (skip
   `Big*` tests via a `-t` filter and omit `test:integration`) so the target
   stays green with a TODO. This is an open decision.

## 8. Testing / verification performed

- `@smithy/core` builds (`yarn build`) and type-checks with 0 errors.
- The submodule linter (`prebuild`) passes after converting self-referencing
  imports to relative imports.
- `./gradlew :smithy-typescript-codegen:compileJava` — success.
- Full protocol-test codegen build — success; the JSON projection now emits
  `test/functional/rpcv2json.spec.ts` (66 cases) and a schema-based client
  (`schemas/`, `commandBuilder.ts`, no classic `protocols/` dir), matching CBOR.
- Generated JSON package builds (`build:cjs` / `build:es` / `build:types` all
  exit 0).
- JSON functional protocol tests: 52 passing; the ~14 failures are exclusively
  `bigInteger` / `bigDecimal` (see §7). `test:index` passes.

## 9. File inventory

Runtime (`@smithy/core`):
- `protocols/json/SmithyRpcV2JsonProtocol.ts` (+ `.spec.ts`)
- `protocols/json/codec-v2/JsonShapeSerializer2.ts` (big-number quoting)
- `protocols/index.ts` (new exports)

Codegen (`smithy-typescript-codegen`):
- `protocols/json/SmithyRpcV2Json.java`
- `protocols/json/JsonRpcMemberSerVisitor.java`
- `protocols/json/JsonRpcMemberDeserVisitor.java`
- `protocols/json/JsonRpcShapeSerVisitor.java`
- `protocols/json/JsonRpcShapeDeserVisitor.java`
- `protocols/AddProtocols.java` (registration)
- `schema/SchemaGenerationAllowlist.java` (gating)
- `integration/AddProtocolConfig.java` (runtime-config default protocol)

Harness:
- `Makefile` (`test-protocols` line)
- `smithy-typescript-protocol-test-codegen/smithy-build.json` (projection; pre-existing)

Generated (not hand-authored; under `private/smithy-rpcv2-json-schema/`): client,
commands, schemas, and `test/functional/rpcv2json.spec.ts`.
