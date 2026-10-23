---
"@smithy/server-common": patch
---

Resolve the concrete modeled error schema in SmithyRpcV2JsonServerProtocol.serializeError. The lookup now matches the thrown error's own class first (walking up the prototype chain only if it is not registered) instead of any registered ancestor, so a registered base service exception can no longer be selected for a subclass. The __type, serialized members, and @httpError status all come from the concrete schema.
