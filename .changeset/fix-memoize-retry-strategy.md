---
"@smithy/middleware-retry": patch
---

fix(middleware-retry): memoize default retry strategy in `resolveRetryConfig` so that `StandardRetryStrategy` capacity and `AdaptiveRetryStrategy` rate limiter state persist across requests instead of being reconstructed per-call.
