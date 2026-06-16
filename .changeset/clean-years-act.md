---
"@smithy/undici-http-handler": major
---

HTTP/2 is no longer enabled by default. Set `allowH2: true` in your dispatcher options to opt in to HTTP/2 negotiation via ALPN.
