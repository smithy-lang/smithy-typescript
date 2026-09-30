---
"@smithy/core": patch
---

restore a compat name-string fallback in ServiceException instanceof for clients predating shapeId stamping, gated on a class-name length of at least 6
