---
"@smithy/undici-http-handler": minor
---

Use the undici global dispatcher as the default fallback when no custom `Agent` options are provided. This respects environment-level proxy/TLS configuration set via `setGlobalDispatcher` without creating a redundant `Agent` instance.
