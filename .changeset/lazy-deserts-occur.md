---
"@smithy/core": patch
---

CBOR spec error handling fixes: the error identifier namespace is no longer incorrectly removed during error lookup. Code property from the body is no longer used as a fallback for error identification. Status code 500 is now classified as server fault.
