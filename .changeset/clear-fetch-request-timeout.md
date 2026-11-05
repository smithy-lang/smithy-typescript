---
"@smithy/fetch-http-handler": patch
---

Clear the `requestTimeout` timer once a request settles. The pending timer kept the request race, and the response it settled with, reachable until it fired, so every completed response (including a fully read body) was retained for the full `requestTimeout`.
