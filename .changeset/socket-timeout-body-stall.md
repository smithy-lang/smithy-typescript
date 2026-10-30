---
"@smithy/node-http-handler": patch
---

Keep configured and service-default socket idle timeouts armed through response bodies, so a body that stalls after fast headers fails with `TimeoutError` instead of hanging. Both register the full idle window on the connected socket. Timeouts of 6000 ms or more keep the 3000 ms registration deferral, which is no longer cancelled on headers, so they may fire up to 3000 ms late. For a complete body, close the socket and leave the buffered body readable.

Socket inactivity includes caller pauses while reading an incomplete body, so consumer backpressure can still trigger `socketTimeout`.
