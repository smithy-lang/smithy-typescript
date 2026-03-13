---
"@smithy/util-retry": minor
"@smithy/middleware-retry": minor
"@smithy/smithy-client": minor
---

feat(util-retry): support AbortSignal in DefaultRateLimiter.getSendToken

Thread AbortSignal from command options through the middleware stack so that
retry delays (both V1 StandardRetryStrategy/AdaptiveRetryStrategy and V2
RetryStrategyV2) can be cancelled early. This enables graceful abort of
retry waits in environments like AWS Lambda.
