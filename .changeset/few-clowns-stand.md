---
"@smithy/core": minor
---

Enable the 2026 standard retry behavior unconditionally. The `SMITHY_NEW_RETRIES_2026` environment variable is no longer read. Standard and adaptive modes now default to a 50 ms base delay for non-throttling errors and a 1 s base delay for throttling errors, retry quota costs of 14 (non-throttling) and 5 (throttling), and apply backoff to long-polling operations when the retry quota is exhausted.
