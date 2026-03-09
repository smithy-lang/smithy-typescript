---
"@smithy/core": patch
---

Remove unnecessary shallow copy of input object and delete operations in `HttpBindingProtocol.serializeRequest` and `RpcProtocol.serializeRequest`. The body serializer is schema-driven and only reads members listed in the payload schema, making the spread and deletes redundant. This eliminates an O(n) copy and 5 delete operations per request.
