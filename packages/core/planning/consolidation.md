# Core Consolidation Plan

This is a consolidation plan for moving the monorepo's packages into the `@smithy/core` package,
specifically one of its submodules managed by package.json `exports` metadata.

The "clients" column shows two counts: direct dependents, then transitive dependents
(i.e. clients that have the package anywhere in their dependency closure), comma-separated.

### core/client

| Package              | LoC  | Description/Rationale             | Clients  | Status |
| -------------------- | ---- | --------------------------------- | -------- | ------ |
| `smithy-client`      | 1504 | Client/command base classes       | 425, 425 | ✅     |
| `middleware-stack`   | 394  | Core middleware infrastructure    | 425, 425 | ✅     |
| `util-middleware`    | 28   | Middleware utilities              | 425, 425 | ✅     |
| `invalid-dependency` | 19   | Placeholder used by smithy-client | 425, 425 | ✅     |
| `util-waiter`        | 373  | Waiter utilities                  | 68, 69   | ✅     |

### core/config

| Package                      | LoC | Description/Rationale                             | Clients  | Status |
| ---------------------------- | --- | ------------------------------------------------- | -------- | ------ |
| `config-resolver`            | 628 | Always code-generated                             | 425, 425 | ✅     |
| `util-config-provider`       | 42  | Only used by config-resolver                      | 0, 425   | ✅     |
| `node-config-provider`       | 200 | Platform-specific, always present in Node clients | 425, 425 | ✅     |
| `shared-ini-file-loader`     | 509 | Only consumer is node-config-provider             | 0, 425   | ✅     |
| `property-provider`          | 309 | Provider chain utilities                          | 0, 425   | ✅     |
| `util-defaults-mode-browser` | 152 | Platform-specific, always code-generated          | 425, 425 | ✅     |
| `util-defaults-mode-node`    | 137 | Platform-specific, always code-generated          | 425, 425 | ✅     |

### core/protocols

| Package                     | LoC | Description/Rationale         | Clients  | Status |
| --------------------------- | --- | ----------------------------- | -------- | ------ |
| `protocol-http`             | 440 | HttpRequest/HttpResponse      | 425, 425 | ✅     |
| `middleware-content-length` | 58  | Always code-generated         | 425, 425 | ✅     |
| `util-uri-escape`           | 22  | Encoding primitive            | 0, 425   | ✅     |
| `querystring-builder`       | 26  | Depends on uri-escape         | 0, 425   | ✅     |
| `querystring-parser`        | 28  | No deps                       | 0, 425   | ✅     |
| `url-parser`                | 25  | Depends on querystring-parser | 425, 425 | ✅     |

### core/serde

| Package                    | LoC  | Description/Rationale             | Clients  | Status    |
| -------------------------- | ---- | --------------------------------- | -------- | --------- |
| `util-base64`              | 164  | Encoding primitive                | 425, 425 | ✅        |
| `util-body-length-browser` | 34   | Platform-specific, protocol-level | 425, 425 | ✅        |
| `util-body-length-node`    | 39   | Platform-specific, protocol-level | 425, 425 | ✅        |
| `util-utf8`                | 55   | Encoding primitive                | 425, 425 | ✅        |
| `util-hex-encoding`        | 49   | Encoding primitive                | 0, 425   | ✅        |
| `util-buffer-from`         | 29   | Supports utf8/base64              | 0, 425   | ✅        |
| `is-array-buffer`          | 6    | Supports buffer-from              | 0, 425   | ✅        |
| `middleware-serde`         | 228  | Always code-generated             | 425, 425 | ✅        |
| `hash-node`                | 52   | Hashing                           | 425, 425 | ✅        |
| `util-stream`              | 1009 | Stream utilities                  | 36, 425  | ✅        |
| `util-stream-browser`      | 127  | Stream utilities                  | 0, 0     | ✅ unused |
| `util-stream-node`         | 101  | Stream utilities                  | 0, 0     | ✅ unused |
| `uuid`                     | 65   | Encoding/generation primitive     | 0, 425   | ✅        |

### core/endpoints

| Package               | LoC | Description/Rationale | Clients  | Status |
| --------------------- | --- | --------------------- | -------- | ------ |
| `util-endpoints`      | 995 | Endpoint rules engine | 425, 425 | ✅     |
| `middleware-endpoint` | 755 | Always code-generated | 425, 425 | ✅     |

### core/retry

| Package                        | LoC | Description/Rationale          | Clients  | Status |
| ------------------------------ | --- | ------------------------------ | -------- | ------ |
| `util-retry`                   | 778 | Retry strategies, rate limiter | 425, 425 | ✅     |
| `middleware-retry`             | 833 | Always code-generated          | 425, 425 | ✅     |
| `service-error-classification` | 142 | Only consumer is retry         | 0, 425   | ✅     |

This is a separate module because the integration tests are very time-consuming, and we'll
likely want to run them separately.

### core/event-streams

| Package                             | LoC | Description/Rationale    | Clients | Status |
| ----------------------------------- | --- | ------------------------ | ------- | ------ |
| `eventstream-codec`                 | 763 | Binary codec             | 0, 37   | ✅     |
| `eventstream-serde-universal`       | 246 | Platform-agnostic serde  | 0, 17   | ✅     |
| `eventstream-serde-browser`         | 138 | Platform-specific        | 17, 17  | ✅     |
| `eventstream-serde-node`            | 106 | Platform-specific        | 17, 17  | ✅     |
| `eventstream-serde-config-resolver` | 38  | Config for event streams | 17, 17  | ✅     |

Clients currently depend on the platform specific `eventstream-serde-browser/node`, which
in turn depends on `-universal`, and then `-codec`.

### core/checksum

| Package                      | LoC | Description/Rationale      | Clients | Status |
| ---------------------------- | --- | -------------------------- | ------- | ------ |
| `hash-blob-browser`          | 18  | S3, S3 Control             | 2, 2    | ✅     |
| `hash-stream-node`           | 102 | S3, S3 Control             | 2, 2    | ✅     |
| `md5-js`                     | 222 | S3, S3 Control, SQS        | 3, 3    | ✅     |
| `chunked-blob-reader`        | 18  | Supports hash-blob-browser | 0, 3    | ✅     |
| `chunked-blob-reader-native` | 47  | Supports hash-blob-browser | 0, 2    | ✅     |

## Stay external

| Package                                  | LoC  | Description/Rationale         | Clients  | Status                         |
| ---------------------------------------- | ---- | ----------------------------- | -------- | ------------------------------ |
| `types`                                  | 4666 | Root of dependency graph      | 425, 425 | ✅                             |
| `core`                                   | 6761 | --                            | 425, 425 | ✅                             |
| `signature-v4`                           | 1425 | Not all clients need signing  | 0, 425   | ✅                             |
| `signature-v4a`                          | 9906 | Very large, optional          | 0, 0     | ✅                             |
| `node-http-handler`                      | 1600 | Platform-specific, large      | 425, 425 | ✅                             |
| `fetch-http-handler`                     | 329  | Platform-specific             | 425, 425 | ✅                             |
| `middleware-compression`                 | 360  | Cloudwatch PutMetricData only | 1, 1     | ✅                             |
| `middleware-apply-body-checksum`         | 104  | S3 Control only               | 1, 1     | ✅                             |
| `credential-provider-imds`               | 682  | AWS-specific, optional        | 0, 425   | ✅                             |
| `experimental-identity-and-auth`         | 876  | Experimental                  | 0, 0     | ✅ unused                      |
| `abort-controller`                       | 70   | Standalone                    | 0, 0     | ✅ optional, deprecated add-on |
| `typecheck`                              | 234  | Small utility                 | 0, 0     | ✅ optional add-on             |
| `snapshot-testing`                       | 1468 | Dev/test tooling              | 31, 31   | ✅ devtool                     |
| `service-client-documentation-generator` | 214  | Codegen tooling               | 0, 0     | ✅ devtool                     |
