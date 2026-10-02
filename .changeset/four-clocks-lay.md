---
"@smithy/server-apigateway": patch
"@smithy/server-common": minor
"@smithy/server-node": patch
---

BREAKING: Update schema-based server handlers to accept framework-owned
`ServerRequest` state and constructor-based configuration. Add
`createServerRequest` adapters for Node.js and API Gateway.
