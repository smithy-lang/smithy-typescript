---
"@smithy/core": patch
---

use Object.keys() in toEndpointV1 to avoid iterating inherited Object.prototype properties
