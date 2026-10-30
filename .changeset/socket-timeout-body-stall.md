---
"@smithy/node-http-handler": patch
---

Keep configured and service-default socket idle timeouts armed through response bodies, so a body that stalls after fast headers fails with `TimeoutError` instead of hanging. Both now register the full idle window on the connected socket immediately, without the previous 3000 ms deferral. For a complete body, close the socket and leave the buffered body readable.

Socket inactivity includes caller pauses while reading an incomplete body, so consumer backpressure can still trigger `socketTimeout`.
