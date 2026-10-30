---
"@smithy/node-http-handler": patch
---

Create one http.Agent for concurrent first requests so destroy() closes every socket.
