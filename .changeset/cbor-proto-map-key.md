---
"@smithy/core": patch
---

Deserialize a CBOR map key named `__proto__` as an own enumerable property, matching the JSON codecs, instead of setting the decoded map's prototype. This affects the raw CBOR decoder (`decodeMapSmall`, `decodeMapIndefinite`), both schema-aware deserializers, and the pre-decoded-object transform. The raw decoder's path for maps of 25 or more entries already produced the own property and is unchanged.
