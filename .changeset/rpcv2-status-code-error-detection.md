---
"@smithy/core": patch
---

Treat any non-200 response as an error in the Smithy RPC v2 JSON and CBOR client protocols, per the specification. RpcProtocol gains a protected isErrorResponse predicate (default unchanged: status >= 300) that both RPC v2 protocols override to status !== 200.
