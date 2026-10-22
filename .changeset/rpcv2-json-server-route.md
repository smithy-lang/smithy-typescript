---
"@smithy/server-common": patch
---

Match the full RPC v2 JSON route in SmithyRpcV2JsonServerProtocol. The protocol now accepts an optional serviceName and verifies the request path's {serviceName} segment against it, and the route regex is anchored so paths for a different service or with trailing segments after the operation no longer match. Generated schema servers pass the modeled service name; when serviceName is omitted the service-name check is skipped (backward compatible).
