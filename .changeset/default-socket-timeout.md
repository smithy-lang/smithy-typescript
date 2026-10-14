---
"@smithy/fetch-http-handler": minor
"@smithy/node-http-handler": minor
"@smithy/types": minor
---

Add a socketTimeout option to the fetch handler that aborts a request after the configured period without download activity, and let NodeHttpHandler and NodeHttp2Handler apply a service default idle timeout on their own timers, leaving socketTimeout and requestTimeout unchanged.
