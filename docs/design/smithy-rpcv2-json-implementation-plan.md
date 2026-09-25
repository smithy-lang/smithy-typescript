# Implementation Plan: Smithy RPC v2 JSON in smithy-typescript

Status: In progress
Author: kingaly
Last updated: 2026-09-15

This plan sequences the work to add Smithy RPC v2 JSON
(`smithy.protocols#rpcv2Json`) to `smithy-typescript`, parallel to the existing
RPC v2 CBOR implementation. It reflects work already completed and orders the
remaining work into four phases:

1. Move JSON codecs from AWS (`aws-sdk-js-v3`) into Smithy (`@smithy/core`).
2. Implement the protocol in TypeScript (runtime).
3. Java codegen updates to generate the JSON protocol-test client under
   `smithy-typescript/private/`.
4. Testing: unit, integration, snapshot, protocol.

Legend: [x] done, [~] partially done, [ ] not started.

---

## Phase 1 — Move JSON codecs from AWS to Smithy

Goal: the JSON serialization codec and its supporting files live in
`@smithy/core` (so both Smithy and the AWS SDK consume one implementation),
mirroring how the CBOR codec lives in `@smithy/core/cbor`.

- [x] 1.1 Copy the JSON codec directories from
  `aws-sdk-js-v3/packages-internal/core/src/submodules/protocols/json/` into
  `smithy-typescript/packages/core/src/submodules/protocols/json/`:
  - `codec-v1/` (`JsonCodec`, `JsonShapeSerializer`, `JsonShapeDeserializer`, `JsonSettings`)
  - `codec-v2/` (`JsonCodec2`, `JsonShapeSerializer2`, `JsonShapeDeserializer2`, `JsonBytesStringAdapter`)
- [x] 1.2 Bring over the JSON support files the codecs import:
  `jsonReviver.ts`, `needsReviver.ts`, `parseJsonBody.ts`, `detectBufferParsing.ts`,
  `jsonReplacer.ts`, `JsonSettings.ts`.
- [x] 1.3 Bring over shared protocol dependencies used by the codecs:
  `ConfigurableSerdeContext.ts`, `UnionSerde.ts`, `writeKey.ts`, `common.ts`,
  `test-schema.spec.ts` (populated the empty/missing stubs).
- [x] 1.4 Fix module boundaries: convert self-referencing `@smithy/core/*`
  imports inside the `protocols` submodule to relative imports so the submodule
  linter (`scripts/validation/submodules-linter.js`, run as `prebuild`) passes.
- [ ] 1.5 Deduplicate with AWS: confirm `aws-sdk-js-v3` re-exports/consumes the
  Smithy codec rather than keeping its own copy. (Cross-repo; out of scope for
  the smithy-typescript change but tracked here so the copies don't drift.)

Exit criteria: `@smithy/core` builds and type-checks; `yarn lint` (submodule
linter) passes. **Met.**

---

## Phase 2 — Implement the protocol in TypeScript (runtime)

Goal: a client protocol class in `@smithy/core` that generated RPC v2 JSON
clients use, mirroring `SmithyRpcV2CborProtocol`.

- [x] 2.1 `SmithyRpcV2JsonProtocol`
  (`protocols/json/SmithyRpcV2JsonProtocol.ts`), extending
  `RpcProtocol` → `HttpProtocol`:
  - `getShapeId()` → `smithy.protocols#rpcv2Json`.
  - Codec: `JsonCodec2`.
  - `getDefaultContentType()` → `application/json`.
  - `serializeRequest`: `content-type`/`accept: application/json`,
    `smithy-protocol: rpc-v2-json`; unit input → no body/content-type; empty
    non-unit body → `"{}"`; append `/service/{service}/operation/{operation}`.
  - `handleError`: `loadJsonRpcErrorCode` (`__type` discriminator) → typed
    exception; members via `JsonShapeDeserializer2.readObject`.
- [x] 2.2 Timestamp conformance: construct `JsonCodec2` with
  `timestampFormat: { useTrait: false, default: 7 }` so timestamps are always
  epoch-seconds and the `timestampFormat` trait is ignored (SEP requirement).
- [x] 2.3 Big-number serialization: `JsonShapeSerializer2.writeValue` writes
  `bigInteger`/`bigDecimal` as quoted JSON strings (schema-driven), regardless of
  incoming JS type (SEP: strings preserve precision).
- [x] 2.4 Public exports (`protocols/index.ts`): `SmithyRpcV2JsonProtocol`,
  `parseJsonBody`, `parseJsonErrorBody`, `loadJsonRpcErrorCode`,
  `loadRestJsonErrorCode`.
- [ ] 2.5 Arbitrary-precision decision (SEP-deferred): either (a) round-trip
  full precision on deserialize, or (b) fail loudly per the SEP
  ("MUST fail when attempting to deserialize"). Currently the deserializer
  returns lossy/`BigInt` values. Recommend deciding (b) as the conformant
  interim until the future arbitrary-precision SEP lands. (See Phase 4 Big*
  failures.)
- [ ] 2.6 (Deferred, non-goal for now) Event-stream content-type branch
  (`application/vnd.amazon.eventstream`) in `serializeRequest`.
- [x] 2.7 `SmithyRpcV2JsonServerProtocol` in `packages/server-common`
  (layer-2), mirroring `SmithyRpcV2CborServerProtocol`: `JsonCodec2`
  (`useTrait: false` epoch-seconds), `application/json`, `rpc-v2-json` header
  validation + response header, `X-Amz(n)-Target` rejection, and error bodies
  with absolute-Shape-ID `__type`. Required `JsonCodec2` to be exported from
  `@smithy/core/protocols`. Hand-written unit spec added (16/16 pass, parity with
  CBOR). Also added `SmithyRpcV2JsonSnapshotProtocol` in `@smithy/snapshot-testing`
  and registered it — this is the response serializer the snapshot harness
  actually resolves (see Phase 4.3).

Exit criteria: unit spec for the protocol passes; `@smithy/core` builds. **Met
for the client protocol (2.1–2.4).**

---

## Phase 3 — Java codegen: generate the JSON protocol-test client

Goal: services modeled with the `rpcv2Json` trait generate a TypeScript client
and protocol tests under `smithy-typescript/private/`, parallel to CBOR.

- [x] 3.1 `SmithyRpcV2Json` generator
  (`codegen/protocols/json/SmithyRpcV2Json.java`), extending
  `HttpRpcProtocolGenerator`:
  - `getProtocol()` → `Rpcv2JsonTrait.ID`.
  - `application/json`, `rpc-v2-json` shared headers.
  - `serializeInputDocument` → `JSON.stringify(...)`.
  - `writeErrorCodeParser` → `loadJsonRpcErrorCode`.
  - `getOperationPath` → `/service/{service}/operation/{operation}`.
  - `generateProtocolTests` → `SmithyProtocolUtils.generateProtocolTests(this, ctx)`.
  - `generateSharedComponents` imports `parseJsonBody as parseBody`,
    `parseJsonErrorBody as parseErrorBody`, `loadJsonRpcErrorCode`, then `super`.
- [x] 3.2 JSON serde visitors (`codegen/protocols/json/`):
  `JsonRpcMemberSerVisitor`, `JsonRpcMemberDeserVisitor` (thin; base defaults +
  epoch-seconds timestamps), `JsonRpcShapeSerVisitor`, `JsonRpcShapeDeserVisitor`
  (mirror CBOR shape visitors, delegate to JSON member visitors).
- [x] 3.3 Register the generator: `AddProtocols.getProtocolGenerators()` returns
  `[SmithyRpcV2Cbor, SmithyRpcV2Json]`. This triggers functional-test generation.
- [x] 3.4 Schema-generation gating: add `Rpcv2JsonTrait.ID` to `PROTOCOLS` and
  `smithy.protocoltests.rpcv2Json#RpcV2JsonProtocol` to `ALLOWED` in
  `SchemaGenerationAllowlist` so the JSON service uses the schema path (not
  classic serde, which failed to type-check).
- [x] 3.5 Runtime-config default protocol: `AddProtocolConfig` SHARED branch for
  `Rpcv2JsonTrait.ID` writes `protocol: SmithyRpcV2JsonProtocol` (from
  `@smithy/core/protocols`) + `protocolSettings.defaultNamespace`. Fixes
  `config.protocol.setSerdeContext is not a function` at client construction.
- [x] 3.6 Build wiring: `smithy-build.json` has the `smithy-rpcv2-json-schema`
  projection (pre-existing); `Makefile generate-protocol-tests` copies the output
  to `private/smithy-rpcv2-json-schema`.

Exit criteria: `./gradlew :smithy-typescript-codegen:compileJava` succeeds;
protocol-test-codegen build emits `private/smithy-rpcv2-json-schema` with
`test/functional/rpcv2json.spec.ts`, `schemas/`, `commandBuilder.ts` (schema
shape, no classic `protocols/` dir); the generated package builds
(`build:cjs`/`build:es`/`build:types`). **Met.**

---

## Phase 4 — Testing

Goal: unit, integration, snapshot, and protocol tests pass (or are consciously
scoped) and are wired into `make test-protocols`.

### 4.1 Unit tests
- [x] `SmithyRpcV2JsonProtocol.spec.ts` (hand-written unit spec: serialize,
  deserialize, error handling) passes.
- [x] `JsonShapeSerializer2` / `JsonShapeDeserializer2` codec specs pass.

### 4.2 Protocol (functional) tests
- [x] Generated `test/functional/rpcv2json.spec.ts` runs; **54 pass**.
- [ ] 12 failing, all `bigInteger`/`bigDecimal` (arbitrary precision):
  - Requests: shared `HttpProtocolTestGenerator.numberNode()` emits big values as
    bare JS number literals that lose precision at parse time. Fix requires
    emitting `BigInt(...)`/`NumericValue` for big-number shapes in generated
    tests — shared codegen affecting all protocols.
  - Responses: deserializer returns `BigInt`; the generated harness cannot
    `JSON.stringify` it in failure messages.
  - This is the SEP-deferred arbitrary-precision area (SEP FAQ: "Not at this
    time... blocked for public AWS services until a separate SEP"). Resolve
    together with 2.5.

### 4.3 Snapshot (integration) tests
- [x] Request snapshots pass (client serialization).
- [x] Response/error snapshots pass. The previous
  `No response serializer found for protocol: smithy.protocols#rpcv2Json` failure
  was resolved by adding `SmithyRpcV2JsonSnapshotProtocol` to
  `@smithy/snapshot-testing` and registering it in
  `snapshotTestingProtocolResponseSerializers` (the harness resolves the
  response serializer from that map by Shape ID — NOT from `server-common`).
  Ran in `write` mode to record baselines under `test/snapshots/{req,res,res-err}`.
  Result: 34/34 snapshot tests pass (was 19 failing). No regression: CBOR
  snapshots 32/32, snapshot-testing own tests 6/6.

### 4.4 Integration into `make test-protocols`
- [~] JSON line added to `test-protocols`. Two options:
  - (A) Full parity with cbor-schema (unfiltered + `test:integration`) once
    4.2 and 4.3 are resolved.
  - (B) Interim: scope the JSON line to the passing functional tests
    (exclude `Big*`) and omit `test:integration`, with a TODO. Keeps
    `make test-protocols` green now.
  - Decision pending; currently the line is in the unfiltered form and will fail
    until 4.2/4.3 land.

### 4.5 Regression
- [x] CBOR still generates `rpcv2cbor.spec.ts` and passes; CBOR schema/tests
  unaffected by the shared changes (`AddProtocols`, `AddProtocolConfig`,
  `SchemaGenerationAllowlist`).
- [ ] Re-verify CBOR after any change to shared `HttpProtocolTestGenerator`
  (needed for 4.2 request fix).

---

## Remaining work, prioritized

1. **Server protocol (2.7 / 4.3):** implement `SmithyRpcV2JsonServerProtocol` in
   `packages/server-common`, register its response serializer for
   `smithy.protocols#rpcv2Json`. Unblocks all 19 snapshot failures. Then record
   and commit snapshot baselines.
2. **Arbitrary precision (2.5 / 4.2):** decide fail-loudly vs full-precision.
   - Fail-loudly is small and SEP-conformant as an interim.
   - Full precision requires shared `HttpProtocolTestGenerator.numberNode()`
     changes (emit `BigInt`/`NumericValue`) plus deserializer/harness handling,
     and re-verifying CBOR.
3. **Makefile decision (4.4):** choose A or B above.
4. **Cross-repo dedup (1.5):** ensure `aws-sdk-js-v3` consumes the Smithy JSON
   codec.
5. **Deferred niceties:** event-stream content-type branch (2.6);
   response `Smithy-Protocol` header validation.

## Dependency order

```
Phase 1 (codecs) ─▶ Phase 2 (runtime client) ─▶ Phase 3 (codegen) ─▶ Phase 4 (tests)
                                     │                                    ▲
                                     └── 2.7 server protocol ─────────────┘ (unblocks 4.3 snapshots)
                                     └── 2.5 arbitrary precision ─────────┘ (unblocks 4.2 Big*)
```

Phases 1–3 are complete. Phase 4 is green except for the two clearly-bounded,
SEP-related workstreams (server protocol → snapshots; arbitrary precision → Big*),
each of which has a dedicated runtime dependency in Phase 2.

---

## Phase 5 — Full SEP conformance (extension)

The SEP surfaces requirements beyond the client happy-path already built. This
phase maps each normative clause to a work item and status, so the plan tracks
conformance, not just "it runs." Grouped by SEP section.

Status legend as above: [x] done, [~] partial, [ ] not started.

### 5.1 Protocol selection & trait
- [x] Shape ID `smithy.protocols#rpcv2Json`; generator keyed on `Rpcv2JsonTrait.ID`.
- [x] "MUST provide support in core `smithy-<lang>`, MUST NOT require AWS
  support": the client protocol lives in `@smithy/core` (not an AWS package) and
  has no AWS dependency. The standalone `SmithyRpcV2Json` generator is in
  smithy-typescript-codegen, separate from any AWS integration.
- [ ] 5.1.1 Protocol priority: place `rpcv2Json` **ahead of AWS JSON 1.0** in the
  SDK protocol priority list. This is an AWS-SDK/codegen ordering concern
  (`aws-sdk-js-v3` protocol resolution + the schema `selectProtocol` ordering).
  Verify the resolver ranks `rpcv2Json` above `awsJson1_0`.
- [ ] 5.1.2 Trait members `http` / `eventStreamHttp`: currently unused. Consume
  them where HTTP-version selection matters (event streams — see 5.6).

### 5.2 Request identification & construction
- [x] `POST`, `smithy-protocol: rpc-v2-json`, `/service/{serviceName}/operation/{operationName}`.
- [x] serviceName/operationName are bare shape names (no namespace) — from
  `getSmithyContext`/model shape names, per the "MUST NOT contain namespace" rule.
- [x] `Content-Type`/`Accept: application/json` for buffered requests.
- [x] Unit input → no body, no `content-type`.
- [x] HTTP binding traits ignored (RPC — everything in the body).
- [x] No `X-Amz-Target`/`X-Amzn-Target` emitted (client side).
- [~] 5.2.1 `Content-Length` SHOULD on buffered requests. Confirm it is set
  (likely by `contentLengthMiddleware` for the schema client). The functional
  `TimestampFormatIgnored:Request` test asserts `content-length` is defined and
  passes, so this is effectively covered — verify it holds for all buffered
  request cases and document the source (middleware vs protocol).
- [ ] 5.2.2 `{prefix?}` runtime path prefix: confirm the client appends the
  operation path onto a configured base-path prefix without breaking routing
  ("last four segments" rule). Add a test with a non-empty endpoint path prefix.

### 5.3 Response handling
- [x] 200 → deserialize output shape; non-200 → error path.
- [ ] 5.3.1 Response `Smithy-Protocol` header validation: "If the response does
  not have the same Smithy-Protocol header as the request, it MUST be considered
  malformed" and handled by HTTP status alone. `deserializeResponse` currently
  does not validate this header. Add the check in the client protocol.
- [x] Clients ignore `x-amzn-ErrorType` (never read on the JSON path).

### 5.4 Shape serialization (wire format)
- [x] boolean/byte/short/integer/long → JSON number.
- [x] float/double → JSON number; NaN/Infinity/-Infinity → JSON strings
  (`JsonShapeSerializer2` handles this).
- [x] string → JSON string; blob → base64 string.
- [x] list → array; map/structure/union → object; null members omitted.
- [x] union `__type` ignored on unknown member (UnionSerde).
- [x] timestamp → epoch-seconds number, `timestampFormat` ignored
  (`useTrait: false`).
- [~] 5.4.1 bigInteger/bigDecimal → JSON strings. Serialize side implemented
  (schema-driven quoting). Deserialize side + arbitrary precision is the deferred
  block below.

### 5.5 Arbitrary-precision numbers (SEP-deferred, choose interim behavior)
The SEP specifies string transport with ABNF grammars, but the FAQ blocks full
SDK support "until a separate SEP." The SEP also gives a conformant escape hatch:
"If an implementation does not support arbitrary precision ... it SHOULD fail
when generating code. If it cannot, it MUST fail when attempting to deserialize."

- [ ] 5.5.1 Decide interim posture. Recommended: **fail loudly** (conformant now,
  small change) rather than silently lose precision.
  - Deserialize: `JsonShapeDeserializer2` for `bigInteger`/`bigDecimal` should
    either return a precision-preserving value (BigInt / NumericValue) OR throw a
    clear "arbitrary precision not supported" error — not return a lossy number.
  - Codegen (optional, stronger): per the SEP's "SHOULD fail when generating
    code," emit a codegen warning/error when a model uses bigInteger/bigDecimal
    under rpcv2Json until full support lands.
- [ ] 5.5.2 (Full support, gated on the future precision SEP) End-to-end lossless
  round-trip. Requires:
  - Shared `HttpProtocolTestGenerator.numberNode()` to emit `BigInt(...)` /
    `NumericValue` for big-number shapes instead of bare JS number literals
    (fixes the request-side precision loss). This is shared across protocols —
    re-verify CBOR.
  - Test-harness comparison that treats number/bigint/NumericValue equivalently
    and does not `JSON.stringify` a `BigInt` in failure messages.
  - Serializer must emit strings conforming to the SEP ABNF grammars
    (bigInteger: no decimal/exponent; bigDecimal: optional fraction/exponent).
    Add a codec unit test asserting grammar conformance.
- Blocks: the 12 `Big*` functional failures (Phase 4.2).

### 5.6 Event streams
- [ ] 5.6.1 Request/response `Content-Type` and `Accept` of
  `application/vnd.amazon.eventstream` for event-streaming operations
  (`serializeRequest` must branch instead of unconditionally setting
  `application/json`). The base `RpcProtocol` already serializes/deserializes
  event streams; only the header selection is missing.
- [ ] 5.6.2 Event-streaming requests MUST NOT set `Content-Length` (chunked).
- [ ] 5.6.3 Honor `eventStreamHttp` / `http` trait members for HTTP-version
  selection (ties to 5.1.2).
- [ ] 5.6.4 Codegen: `JsonRpcShapeSerVisitor`/generator event-stream body framing
  parity with CBOR's `generateEventStreamSerializers/Deserializers`.

### 5.7 Errors
- [x] Discriminate via body `__type` (`loadJsonRpcErrorCode`).
- [x] Do not use `Code`/`code`/`x-amzn-errortype` to distinguish (loader prefers
  `__type`; note the shared loader still has fallbacks — acceptable since
  `__type` is present, but see 5.7.1).
- [ ] 5.7.1 Strictly, the loader MUST NOT use `code`/header to distinguish. If
  strict conformance is desired for the pure-Smithy protocol, use a
  `__type`-only loader path (the fallback order exists for awsQueryCompatible).
- [x] `message` field generated/deserialized.
- [ ] 5.7.2 Error status codes: verify `@httpError` value is honored, else 500
  for `@error("server")`, else 400. (Server-side concern — see 5.9.)
- [ ] 5.7.3 Error shape renaming MUST NOT apply to error shapes. Add a codegen
  guard/validator or a test that error `__type` uses the absolute shape ID
  unaffected by `rename`.
- [ ] 5.7.4 Malformed error response (bad/absent `Smithy-Protocol`) handled by
  status code only (ties to 5.3.1).

### 5.8 Default values
- [ ] 5.8.1 Client error-correction: "Client deserializers SHOULD fill in a
  default zero value for an omitted required member." Confirm the schema
  deserializer error-corrects; add a test.
- [ ] 5.8.2 (Server) Omit defaults for members marked `internal`. Server concern
  (5.9).

### 5.9 Server-side protocol (`SmithyRpcV2JsonServerProtocol`)
Required to unblock the 19 snapshot response/error failures and for full SEP
coverage of response/error *serialization*.
- [ ] 5.9.1 Implement `SmithyRpcV2JsonServerProtocol` in
  `packages/server-common/src/protocols-schema/layer-2-protocols/`, parallel to
  `SmithyRpcV2CborServerProtocol`: response serialization (JSON body, 200,
  `smithy-protocol: rpc-v2-json`, content-type/length), error serialization
  (status from `@httpError`/fault rules, `__type` + `message`), request
  identification/claiming, and rejection of `X-Amz(n)-Target`.
- [ ] 5.9.2 Register the response serializer for `smithy.protocols#rpcv2Json`
  (the missing piece behind "No response serializer found for protocol").
- [ ] 5.9.3 Server codegen support if generating SSDKs for rpcv2Json.

### 5.10 awsQueryCompatible (AWS layer, not core Smithy)
- [ ] 5.10.1 Out of scope for the pure-Smithy protocol. When wired into
  `aws-sdk-js-v3`, add `awsQueryCompatible` handling (the `x-amzn-query-error`
  header, empty-list defaulting) — mirror `AwsJsonRpcProtocol`'s approach. Keep
  it in an AWS-layer protocol subclass, not `@smithy/core`.

### 5.11 C2J / metadata (AWS layer)
- [ ] 5.11.1 `protocol`/`type` value `smithy-rpc-v2-json`; `targetPrefix` = service
  shape name; `h2` protocolSettings for event streams. Relevant when generating
  from C2J in the AWS SDK; verify the AWS codegen mapping.

---

## Revised remaining-work priority (SEP-informed)

1. **Server protocol (5.9)** — unblocks all 19 snapshot failures; needed for
   response/error serialization conformance. Highest leverage.
2. **Response `Smithy-Protocol` validation (5.3.1) + strict `__type` error
   loading (5.7.1)** — small client-side conformance gaps.
3. **Arbitrary precision (5.5)** — pick fail-loudly interim (5.5.1) now; full
   support (5.5.2) waits on the future SEP. Unblocks/【brackets】the 12 Big*.
4. **Event streams (5.6)** — content-type/accept branching + header rules.
5. **Protocol priority + trait members (5.1.1/5.1.2), prefix routing (5.2.2),
   default-value error correction (5.8.1), error renaming guard (5.7.3)** —
   conformance hardening, each with a targeted test.
6. **AWS-layer items (5.10, 5.11, 5.1.1 ordering in aws-sdk-js-v3)** — when
   integrating with the AWS SDK.

Each item above should land with a focused test (functional protocol test where
one exists in the model, otherwise a unit test in `@smithy/core` or
`server-common`), and any change to shared `HttpProtocolTestGenerator` must
re-verify CBOR for no regression.
