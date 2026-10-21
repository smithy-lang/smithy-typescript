---
"@smithy/server-common": patch
---

Serialize RPC v2 JSON operation errors through the modeled error schema. This emits the error's absolute Shape ID as `__type` (fixing the wrong namespace for errors modeled outside the service's default namespace) and encodes members according to their modeled types (fixing lost type information for members such as bigInteger/bigDecimal). Unmodeled errors keep the previous document-based fallback.
