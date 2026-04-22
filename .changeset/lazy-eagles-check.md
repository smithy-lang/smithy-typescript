---
"@smithy/node-http-handler": patch
---

update http2 session closure to prefer session.close() on goaway rather than immediately invoking session.destroy()
