---
"@smithy/undici-http-handler": minor
---

Use the undici global dispatcher as the default fallback when no custom `Agent` options are provided. This respects environment-level proxy/TLS configuration set via `setGlobalDispatcher` without creating a redundant `Agent` instance. Event-stream requests now also route through the resolved dispatcher (caller-supplied `Dispatcher` or the global dispatcher) and only use an isolated `Client` when the handler owns the dispatcher (created from `Agent.Options`), so a global `ProxyAgent`/`MockAgent` is honored for event streams too.
