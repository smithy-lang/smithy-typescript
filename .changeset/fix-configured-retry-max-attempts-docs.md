---
"@smithy/core": patch
---

Correct the `ConfiguredRetryStrategy` `maxAttempts` documentation: it is the maximum number of attempts including the initial request, not the number of retries.
