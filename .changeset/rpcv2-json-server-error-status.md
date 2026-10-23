---
"@smithy/server-common": patch
---

Honor the modeled @httpError trait when resolving the status code for RPC v2 JSON error responses. serializeError now delegates to the shared resolveErrorStatusCode helper (explicit runtime status, then @httpError, then the fault default) instead of only checking runtime status and falling back to 400/500, so a modeled @httpError value is applied even when the runtime error carries no status.
