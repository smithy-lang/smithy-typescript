---
"@smithy/node-http-handler": patch
---

consolidate checkSocketUsage timers to reduce overhead

Replace per-request setTimeout/clearTimeout with a single shared timer that
re-arms itself while requests are in flight. The timer stops automatically
when all requests complete, preserving the original behavior of not warning
on transient spikes.

Note: the shared timer now checks both the HTTP and HTTPS agents on each
tick, whereas the old per-request timer only checked the agent for that
specific request's protocol. This is a minor behavioral change that
improves coverage (catches saturation on either agent).
