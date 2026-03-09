---
"@smithy/core": patch
---

feat(schema): add caching to NormalizedSchema.of() and translateTraits()

Add WeakMap-based caching to `NormalizedSchema.of()` for object-type schemas and Map-based caching with `Object.freeze()` to `translateTraits()` for numeric bitmask inputs. This eliminates redundant construction on hot serialization/deserialization paths.
