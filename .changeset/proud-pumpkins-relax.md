---
"@smithy/middleware-retry": minor
"@smithy/util-retry": minor
"@smithy/types": minor
---

Introduce default retry behavior modifications slated for 2026. They are:
less time between server error retries, but slightly more time between throttling errors. Lower retry capacity consumption for throttling, and improved parsing of the retry-after and x-amz-retry-after headers.
