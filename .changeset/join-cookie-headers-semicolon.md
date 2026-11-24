---
"@smithy/server-apigateway": patch
---

Join multiple `Cookie` header values from an API Gateway v1 event with `; ` instead of `, `, and keep the commas inside a `Set-Cookie` `Expires` attribute when writing the v1 response headers.
