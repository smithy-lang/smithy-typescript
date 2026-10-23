---
"@smithy/server-common": patch
---

Return an empty body and no Content-Type for RPC v2 JSON operations whose output targets the Unit shape, per the specification, instead of an empty JSON object with a Content-Type.
