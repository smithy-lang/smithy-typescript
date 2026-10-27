---
"@smithy/node-http-handler": patch
---

Register configured positive socket idle timeouts immediately with the full rolling idle window, and keep them armed through response bodies. Preserve completed but unread bodies for configured and service-default timeouts, and fail incomplete bodies with `TimeoutError`. Service-default timeout deferral and timing are unchanged.

Close stalled unfinished uploads after a complete response without discarding its unread body.

Socket inactivity includes caller pauses while reading an incomplete body, so consumer backpressure can still trigger `socketTimeout`.
