---
"@smithy/core": patch
---

Resolve empty httpPayload bindings based on content-type and target schema type, returning empty containers for unstructured formats instead of leaving the member unset.
