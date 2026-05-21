---
"@smithy/undici-http-handler": patch
---

Document that passing a user-owned Dispatcher lets the application pin a newer undici than the one bundled with the handler, picking up upstream performance improvements (HTTP parser, connection pooling, etc.).
