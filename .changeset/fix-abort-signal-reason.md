---
"@smithy/node-http-handler": patch
"@smithy/fetch-http-handler": patch
---

fix: reject aborted requests with AbortSignal.reason instead of a generic Error
