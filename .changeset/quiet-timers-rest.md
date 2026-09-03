---
"@smithy/node-http-handler": patch
---

Clear the HTTP/2 session timeout before destroying a session. Node keeps a destroyed `Http2Session` reachable until its pending `setTimeout` fires, so with the default 300 s timer on isolated sessions every completed request was retained for 5 minutes.
