---
"@smithy/node-http-handler": patch
---

skip sending body without waiting for a timeout on response, if "expect" request header with "100-continue" is provided
