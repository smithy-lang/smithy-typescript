---
"@smithy/server-common": patch
---

Tighten SmithyRpcV2JsonServerProtocol request claiming to require the POST method and an RPC v2 route-shaped path, per the Smithy RPC v2 specification, so a GET or an unrelated path is no longer claimed.
